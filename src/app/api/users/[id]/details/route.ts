import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = Number(params.id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID pengguna tidak valid' },
        { status: 400 }
      );
    }

    const baseUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, kebunId: true }
    });
    if (!baseUser) {
      return NextResponse.json(
        { error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    let kebunIds: number[] = [];
    if (baseUser.role === 'MANDOR' && baseUser.kebunId) {
      kebunIds = [baseUser.kebunId];
    } else if (baseUser.role === 'MANAGER') {
      try {
        const rows = await prisma.$queryRaw<Array<{ id: number }>>(
          Prisma.sql`SELECT "A" as id FROM "_UserKebuns" WHERE "B" = ${userId}`
        );
        kebunIds = rows.map(r => r.id);
      } catch {
        kebunIds = [];
      }
    }

    let kebunTerikat: Array<{ id: number; name: string }> = [];
    if (kebunIds.length > 0) {
      const kebuns = await prisma.kebun.findMany({
        where: { id: { in: kebunIds } },
        select: { id: true, name: true }
      });
      kebunTerikat = kebuns;
    }

    // 1. Fetch Salary History (Riwayat Gaji)
    // Assuming salary comes from NotaSawit (for Supir) or related transactions
    // We will fetch NotaSawit items that are processed/paid
    const riwayatGaji = await prisma.notaSawit.findMany({
      where: {
        supirId: userId,
        // Optional: filter by status if needed, e.g., only completed ones
        // statusPembayaran: 'LUNAS' 
      },
      include: {
        pabrikSawit: {
          select: { name: true }
        },
        gajian: {
            select: {
                id: true,
                tanggalMulai: true,
                tanggalSelesai: true,
                status: true
            }
        }
      },
      orderBy: {
        tanggalBongkar: 'desc',
      },
      take: 50 // Limit to last 50 entries
    });

    // 2. Fetch Debt History (Riwayat Hutang)
    // Fetch KasTransaksi where karyawanId is the user
    const riwayatHutang = await prisma.kasTransaksi.findMany({
      where: {
        karyawanId: userId,
        // We might want to filter by categories if specific ones exist for debt
        // For now, fetch all transactions involving the employee
      },
      orderBy: {
        date: 'desc',
      },
      take: 50
    });

    return NextResponse.json({
      kebunTerikat,
      riwayatGaji,
      riwayatHutang
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil detail pengguna' },
      { status: 500 }
    );
  }
}
