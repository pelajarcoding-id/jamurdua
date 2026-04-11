import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createAuditLog } from '@/lib/audit';
import { scheduleFileDeletion } from '@/lib/file-retention';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
        if (guard.response) return guard.response
        const id = Number(params.id);
        const body = await request.json();
        
        const { sku, name, unit, category, stock, minStock, price, imageUrl: newImageUrl, removeImage } = body;

        // Get existing item
        const existingItem = await prisma.inventoryItem.findUnique({
            where: { id }
        });

        if (!existingItem || (existingItem as any).deletedAt) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        let imageUrl = (existingItem as any).imageUrl;

        if (removeImage && imageUrl) {
            await scheduleFileDeletion({
                url: imageUrl,
                entity: 'InventoryItem',
                entityId: String(id),
                reason: 'REMOVE_IMAGE',
            })
            imageUrl = null;
        }

        if (newImageUrl !== undefined) {
             // Delete old image if exists and not already removed
             if (imageUrl && imageUrl !== newImageUrl && !removeImage) {
                await scheduleFileDeletion({
                    url: imageUrl,
                    entity: 'InventoryItem',
                    entityId: String(id),
                    reason: 'REPLACE_IMAGE',
                })
            }
            imageUrl = newImageUrl || null;
        }

        const updatedItem = await prisma.inventoryItem.update({
            where: { id },
            data: {
                sku,
                name,
                unit,
                category,
                stock: stock !== undefined ? Number(stock) : undefined,
                minStock: minStock !== undefined ? Number(minStock) : undefined,
                price: price !== undefined ? Number(price) : undefined,
                imageUrl
            } as any
        });

        await createAuditLog(guard.id, 'UPDATE', 'InventoryItem', String(id), {
            before: existingItem,
            after: updatedItem,
        });

        return NextResponse.json(updatedItem);

    } catch (error) {
        console.error('Error updating inventory item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
        if (guard.response) return guard.response
        const id = Number(params.id);

        const before = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!before || (before as any).deletedAt) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const item = await prisma.inventoryItem.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                deletedById: guard.id,
            } as any
        });

        if ((item as any).imageUrl) {
            await scheduleFileDeletion({
                url: (item as any).imageUrl,
                entity: 'InventoryItem',
                entityId: String(id),
                reason: 'DELETE_ITEM',
            })
        }

        await createAuditLog(guard.id, 'DELETE', 'InventoryItem', String(id), { before });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
