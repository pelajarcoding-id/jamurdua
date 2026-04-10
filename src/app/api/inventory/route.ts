import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '10');
    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { unit: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
        ];
        const isNumeric = /^\d+(\.\d+)?$/.test(search);
        if (isNumeric) {
            const like = `%${search}%`;
            const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
                Prisma.sql`SELECT i.id
                           FROM "InventoryItem" i
                           WHERE i."deletedAt" IS NULL AND (CAST(i.id AS TEXT) ILIKE ${like}
                              OR CAST(i.stock AS TEXT) ILIKE ${like}
                              OR CAST(i."minStock" AS TEXT) ILIKE ${like}
                              OR CAST(i.price AS TEXT) ILIKE ${like})`
            );
            const numericIds = idsRows.map(r => r.id);
            if (numericIds.length > 0) {
                where.OR.push({ id: { in: numericIds } });
            }
        }
    }

    if (category && category !== 'ALL') {
        where.category = category;
    }

    const [items, total, lowStockCount, categories] = await prisma.$transaction([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.count({
        where: {
            deletedAt: null,
            stock: { lte: prisma.inventoryItem.fields.minStock }
        }
      }),
      prisma.inventoryItem.findMany({
        select: { category: true },
        distinct: ['category'],
        where: { category: { not: null }, deletedAt: null }
      })
    ]);

    const uniqueCategories = categories.map(c => c.category).filter(Boolean);

    return NextResponse.json({
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      lowStockCount,
      categories: uniqueCategories
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
        if (guard.response) return guard.response
        const formData = await request.formData();
        const raw = {
            sku: formData.get('sku'),
            name: formData.get('name'),
            unit: formData.get('unit'),
            category: formData.get('category'),
            stock: formData.get('stock'),
            minStock: formData.get('minStock'),
            price: formData.get('price'),
            date: formData.get('date'),
        };
        const schema = z.object({
            sku: z.string().trim().min(1).max(64),
            name: z.string().trim().min(1).max(128),
            unit: z.string().trim().min(1).max(32),
            category: z
                .string()
                .trim()
                .max(64)
                .optional()
                .transform((v) => (v && v.length > 0 ? v : undefined)),
            stock: z.coerce.number().int().nonnegative(),
            minStock: z.coerce.number().int().nonnegative(),
            price: z.coerce.number().nonnegative().optional(),
            date: z.string().optional(),
        });
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }
        const { sku, name, unit, category, stock, minStock, price = 0, date } = parsed.data;
        const image = formData.get('image') as File | null;

        let imageUrl = null;
        if (image) {
            const bytes = await image.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filename = `${Date.now()}-${image.name}`;
            const uploadDir = join(process.cwd(), 'public/uploads/inventory');
            
            await mkdir(uploadDir, { recursive: true });
            await writeFile(join(uploadDir, filename), buffer);
            imageUrl = `/uploads/inventory/${filename}`;
        }

        const item = await prisma.inventoryItem.create({
            data: {
                sku,
                name,
                unit,
                category,
                stock,
                initialStock: stock,
                minStock,
                price,
                imageUrl,
                createdAt: date ? new Date(date) : undefined
            } as any
        });

        // Audit Log
        await createAuditLog(guard.id, 'CREATE', 'InventoryItem', item.id.toString(), {
            sku,
            name,
            stock,
            category
        });

        return NextResponse.json(item);
    } catch (error) {
        console.error('Error creating inventory item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
