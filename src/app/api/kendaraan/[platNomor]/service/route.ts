import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/auth';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { platNomor: string } }
) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const cursorParam = url.searchParams.get('cursorId');
    const page = pageParam ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const limit = limitParam ? Math.max(parseInt(limitParam, 10) || 10, 1) : 10;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (end) {
      end.setDate(end.getDate() + 1);
    }

    const where = {
      kendaraanPlat: params.platNomor,
      ...(start || end
        ? {
            date: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lt: end } : {}),
            },
          }
        : {}),
    };

    const total = await prisma.serviceLog.count({ where });

    let logs;
    if (cursorParam) {
      logs = await prisma.serviceLog.findMany({
        where,
        include: {
          items: {
            include: {
              inventoryItem: true
            }
          }
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        cursor: { id: Number(cursorParam) },
        skip: 1,
        take: limit,
      });
    } else {
      logs = await prisma.serviceLog.findMany({
        where,
        include: {
          items: {
            include: {
              inventoryItem: true
            }
          }
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    const nextCursor = logs.length > 0 ? logs[logs.length - 1].id : null;
    return NextResponse.json({ data: logs, total, nextCursor });
  } catch (error) {
    console.error('Error fetching service logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { platNomor: string } }
) {
  try {
    const body = await request.json();
    const { date, description, cost, odometer, nextServiceDate, items, fotoUrl } = body;
    
    const session = await auth();
    // @ts-ignore
    const userId = session?.user?.id ? Number(session.user.id) : 1;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Service Log
      const log = await tx.serviceLog.create({
        data: {
          kendaraanPlat: params.platNomor,
          date: new Date(date),
          description,
          cost: Number(cost),
          odometer: odometer ? Number(odometer) : null,
          nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
          fotoUrl: fotoUrl || null,
        },
      });

      // 2. Process Inventory Items
      if (items && items.length > 0) {
        for (const item of items) {
          // Create ServiceLogItem
          await tx.serviceLogItem.create({
            data: {
              serviceLogId: log.id,
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
            },
          });

          // Update Inventory Stock (Decrement)
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          // Record Inventory Transaction (OUT)
          await tx.inventoryTransaction.create({
            data: {
              itemId: item.inventoryItemId,
              type: 'OUT',
              quantity: item.quantity,
              notes: `Service Kendaraan ${params.platNomor}`,
              userId: userId,
            }
          });
        }
      }
      return log;
    });

    await createAuditLog(userId, 'CREATE', 'ServiceLog', String(result.id), {
      kendaraanPlat: params.platNomor,
      date,
      description,
      cost: Number(cost),
      odometer: odometer ? Number(odometer) : null,
      nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
      items: items || [],
      fotoUrl: (result as any)?.fotoUrl || null,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating service log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
