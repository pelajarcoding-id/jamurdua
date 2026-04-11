import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = Number(params.id);
    const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const currentUserId = guard.id

    const body = await request.json();
    const { type, quantity, notes, date, imageUrl } = body;

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
                imageUrl: imageUrl || null,
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
