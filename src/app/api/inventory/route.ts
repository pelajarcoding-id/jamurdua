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
        const body = await request.json();
        const { sku, name, unit, category, stock, minStock, price = 0, date, imageUrl } = body;

        const item = await prisma.inventoryItem.create({
            data: {
                sku,
                name,
                unit,
                category,
                stock: Number(stock),
                initialStock: Number(stock),
                minStock: Number(minStock),
                price: Number(price),
                imageUrl: imageUrl || null,
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
