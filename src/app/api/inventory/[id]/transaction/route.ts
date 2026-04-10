import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/route-auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = Number(params.id);
    const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const currentUserId = guard.id

    const formData = await request.formData();
    const raw = {
      type: formData.get('type'),
      quantity: formData.get('quantity'),
      notes: formData.get('notes'),
      date: formData.get('date'),
    };
    const schema = z.object({
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
      quantity: z.coerce.number().int().nonnegative(),
      notes: z.string().trim().max(500).optional(),
      date: z.string().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { type, quantity, notes, date } = parsed.data;
    const image = formData.get('image') as File | null;

    let imageUrl = null;
    if (image) {
        const MAX_BYTES = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (typeof (image as any).size === 'number' && (image as any).size > MAX_BYTES) {
          return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }
        if (image.type && !allowedTypes.includes(image.type)) {
          return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
        }
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${Date.now()}-${image.name}`;
        const uploadDir = join(process.cwd(), 'public/uploads/inventory-transactions');
        
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), buffer);
        imageUrl = `/uploads/inventory-transactions/${filename}`;
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    let newStock = item.stock;
    if (type === 'IN') newStock += Number(quantity);
    else if (type === 'OUT') newStock -= Number(quantity);
    else if (type === 'ADJUSTMENT') newStock = Number(quantity);

    const [updatedItem, transaction] = await prisma.$transaction([
        prisma.inventoryItem.update({
            where: { id: itemId },
            data: { stock: newStock }
        }),
        prisma.inventoryTransaction.create({
            data: {
                itemId,
                type,
                quantity: Number(quantity),
                notes,
                userId: currentUserId,
                imageUrl,
                createdAt: date ? new Date(date) : undefined
            } as any
        })
    ]);

    await createAuditLog(currentUserId, 'UPDATE', 'Inventory', itemId.toString(), {
        itemName: item.name,
        type,
        quantity: Number(quantity),
        oldStock: item.stock,
        newStock,
        notes
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error processing transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
