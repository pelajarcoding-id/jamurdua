import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { requireRole } from '@/lib/route-auth';

export async function GET() {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const jurnal = await prisma.jurnal.findMany({
      orderBy: {
        date: 'desc',
      },
    });
    return NextResponse.json(jurnal);
  } catch (error) {
    console.error('Error fetching jurnal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const body = await request.json();
    const { date, akun, deskripsi, debit, kredit } = body;

    if (!date || !akun || !deskripsi) {
      return NextResponse.json(
        { error: 'Date, akun, and deskripsi are required' },
        { status: 400 }
      );
    }

    if (typeof debit !== 'number' || typeof kredit !== 'number') {
        return NextResponse.json(
            { error: 'Debit and kredit must be numbers' },
            { status: 400 }
        );
    }

    const newJurnal = await prisma.jurnal.create({
      data: {
        date: new Date(date),
        akun,
        deskripsi,
        debit,
        kredit,
      },
    });

    // Audit Log
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id;
    await createAuditLog(currentUserId, 'CREATE', 'Jurnal', newJurnal.id.toString(), {
        akun,
        deskripsi,
        debit,
        kredit
    });

    return NextResponse.json(newJurnal, { status: 201 });
  } catch (error) {
    console.error('Error creating jurnal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
