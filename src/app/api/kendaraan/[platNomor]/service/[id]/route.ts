
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { scheduleFileDeletion } from '@/lib/file-retention';

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { platNomor: string; id: string } }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
    const body = await request.json();  
    const { date, description, cost, odometer, nextServiceDate, fotoUrl } = body;
    const id = parseInt(params.id);

    const before = await prisma.serviceLog.findUnique({
      where: { id: id, kendaraanPlat: params.platNomor },
    });

    const updateData: any = {
      date: new Date(date),
      description,
      cost: Number(cost),
      odometer: odometer ? Number(odometer) : null,
      nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
    };

    const existing = await prisma.serviceLog.findUnique({
      where: { id: id, kendaraanPlat: params.platNomor },
      select: { fotoUrl: true }
    });

    if (fotoUrl !== undefined) {
      if (fotoUrl && existing?.fotoUrl && existing.fotoUrl !== fotoUrl) {
        await scheduleFileDeletion({
          url: existing.fotoUrl,
          entity: 'ServiceLog',
          entityId: String(id),
          reason: 'REPLACE_IMAGE',
        })
      }
      updateData.fotoUrl = fotoUrl || null;
    }

    const log = await prisma.serviceLog.update({
      where: {
        id: id,
        kendaraanPlat: params.platNomor,
      },
      data: updateData,
    });

    await createAuditLog(currentUserId, 'UPDATE', 'ServiceLog', String(log.id), {
      kendaraanPlat: params.platNomor,
      before,
      after: log,
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('Error updating service log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { platNomor: string; id: string } }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
    const id = parseInt(params.id);

    const existing = await prisma.serviceLog.findUnique({
      where: { id: id, kendaraanPlat: params.platNomor },
      select: { fotoUrl: true, id: true, date: true, description: true, cost: true, odometer: true, nextServiceDate: true }
    });

    await prisma.serviceLog.delete({
      where: {
        id: id,
        kendaraanPlat: params.platNomor,
      },
    });

    if (existing?.fotoUrl) {
      await scheduleFileDeletion({
        url: existing.fotoUrl,
        entity: 'ServiceLog',
        entityId: String(id),
        reason: 'DELETE_LOG',
      })
    }

    await createAuditLog(currentUserId, 'DELETE', 'ServiceLog', String(id), {
      kendaraanPlat: params.platNomor,
      before: existing,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
