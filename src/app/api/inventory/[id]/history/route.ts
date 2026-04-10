import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const guard = await requireRole(['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR'])
        if (guard.response) return guard.response
        const id = Number(params.id);
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get('limit') || '20');
        const page = Number(searchParams.get('page') || '1');
        
        const skip = (page - 1) * limit;

        const [transactions, total] = await prisma.$transaction([
            prisma.inventoryTransaction.findMany({
                where: { itemId: id },
                include: {
                    user: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.inventoryTransaction.count({
                where: { itemId: id }
            })
        ]);

        const stats = await prisma.inventoryTransaction.groupBy({
            by: ['type'],
            where: { itemId: id },
            _sum: {
                quantity: true
            }
        });

        const summary = {
            totalIn: stats.find(s => s.type === 'IN')?._sum?.quantity || 0,
            totalOut: stats.find(s => s.type === 'OUT')?._sum?.quantity || 0,
            totalAdjustment: stats.find(s => s.type === 'ADJUSTMENT')?._sum?.quantity || 0
        };

        return NextResponse.json({
            data: transactions,
            summary,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
