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
        const formData = await request.formData();
        
        const sku = formData.get('sku') as string;
        const name = formData.get('name') as string;
        const unit = formData.get('unit') as string;
        const category = formData.get('category') as string;
        const stock = formData.has('stock') ? Number(formData.get('stock')) : undefined;
        const minStock = formData.has('minStock') ? Number(formData.get('minStock')) : undefined;
        const price = formData.has('price') ? Number(formData.get('price')) : undefined;
        const image = formData.get('image') as File | null;
        const removeImage = formData.get('removeImage') === 'true';

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

        if (image) {
             // Delete old image if exists and not already removed
             if (imageUrl && !removeImage) {
                await scheduleFileDeletion({
                    url: imageUrl,
                    entity: 'InventoryItem',
                    entityId: String(id),
                    reason: 'REPLACE_IMAGE',
                })
            }

            const bytes = await image.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filename = `${Date.now()}-${image.name}`;
            const uploadDir = join(process.cwd(), 'public/uploads/inventory');
            
            await mkdir(uploadDir, { recursive: true });
            await writeFile(join(uploadDir, filename), buffer);
            imageUrl = `/uploads/inventory/${filename}`;
        }

        const updatedItem = await prisma.inventoryItem.update({
            where: { id },
            data: {
                sku,
                name,
                unit,
                category,
                stock, // Optional update
                minStock, // Optional update
                price, // Optional update
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
