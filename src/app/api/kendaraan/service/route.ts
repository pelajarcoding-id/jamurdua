import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    console.error('Error fetching all service logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
