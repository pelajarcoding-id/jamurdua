import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Notification } from '@prisma/client';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : null;

    // 1. Fetch DB Notifications
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: userId }, // Personal notifications
          { userId: null }    // Global notifications (if any)
        ]
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // 2. Fetch Vehicle Alerts
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const expiringVehicles = await prisma.kendaraan.findMany({
      where: {
        OR: [
          { tanggalMatiStnk: { lte: thirtyDaysLater } },
          { speksi: { lte: thirtyDaysLater } },
          { tanggalPajakTahunan: { lte: thirtyDaysLater } },
        ],
      },
    });

    // 3. Fetch Bank Debt Alerts
    const activeLoans = await (prisma as any).hutangBank.findMany({
      where: { status: 'AKTIF' },
      include: {
        kasTransaksi: {
          where: {
            tipe: 'PENGELUARAN',
            deletedAt: null,
            date: {
              gte: new Date(today.getFullYear(), today.getMonth(), 1),
              lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
            }
          }
        }
      }
    });

    const bankAlerts = activeLoans.flatMap((loan: any) => {
      const alerts = [];
      const currentDay = today.getDate();
      const dueDay = loan.jatuhTempo || 1;
      
      // Check if already paid this month
      const alreadyPaid = loan.kasTransaksi.length > 0;
      
      if (!alreadyPaid) {
        const daysUntilDue = dueDay - currentDay;
        
        // Show alert if due in 7 days or already late
        if (daysUntilDue <= 7) {
          const isLate = daysUntilDue < 0;
          alerts.push({
            id: `loan-${loan.id}-due`,
            type: 'BILL',
            title: `Angsuran ${loan.namaBank}`,
            message: `${isLate ? `Terlambat ${Math.abs(daysUntilDue)} hari` : `${daysUntilDue === 0 ? 'Jatuh tempo hari ini' : `${daysUntilDue} hari lagi`}`}`,
            date: new Date(),
            link: `/hutang-bank`,
            isRead: false,
            source: 'system'
          });
        }
      }
      
      return alerts;
    });

    // 4. Map to common format
    const getDaysLeft = (date: Date) => Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

    const vehicleAlerts = expiringVehicles.flatMap(v => {
      const alerts = [];
      
      // STNK
      const stnkDays = getDaysLeft(v.tanggalMatiStnk);
      if (stnkDays <= 30) {
        const isLate = stnkDays < 0;
        alerts.push({
          id: `veh-${v.platNomor}-stnk`,
          type: 'STNK',
          title: `Pajak STNK ${v.platNomor}`,
          message: `${v.merk} - ${isLate ? `Telat ${Math.abs(stnkDays)} hari` : `${stnkDays} hari lagi`}`,
          date: new Date(),
          link: `/kendaraan?search=${v.platNomor}`,
          isRead: false,
          source: 'system'
        });
      }

      // Pajak Tahunan
      if (v.tanggalPajakTahunan) {
        const pajakDays = getDaysLeft(v.tanggalPajakTahunan);
        if (pajakDays <= 30) {
          const isLate = pajakDays < 0;
          alerts.push({
            id: `veh-${v.platNomor}-pajak`,
            type: 'STNK',
            title: `Pajak Tahunan ${v.platNomor}`,
            message: `${v.merk} - ${isLate ? `Telat ${Math.abs(pajakDays)} hari` : `${pajakDays} hari lagi`}`,
            date: new Date(),
            link: `/kendaraan?search=${v.platNomor}`,
            isRead: false,
            source: 'system'
          });
        }
      }

      // Speksi
      if (v.speksi) {
        const speksiDays = getDaysLeft(v.speksi);
        if (speksiDays <= 30) {
          const isLate = speksiDays < 0;
          alerts.push({
            id: `veh-${v.platNomor}-speksi`,
            type: 'STNK',
            title: `KIR/Speksi ${v.platNomor}`,
            message: `${v.merk} - ${isLate ? `Telat ${Math.abs(speksiDays)} hari` : `${speksiDays} hari lagi`}`,
            date: new Date(),
            link: `/kendaraan?search=${v.platNomor}`,
            isRead: false,
            source: 'system'
          });
        }
      }
      
      return alerts;
    });

    const formattedNotifications = [
      ...notifications.map((n: Notification) => ({
        id: `db-${n.id}`,
        dbId: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        date: n.createdAt,
        link: n.link,
        isRead: n.isRead,
        source: 'database'
      })),
      ...vehicleAlerts,
      ...bankAlerts
    ];

    // Sort by date desc
    formattedNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
    try {
        const { id } = await request.json();
        
        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await prisma.notification.update({
            where: { id: Number(id) },
            data: { isRead: true }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const all = searchParams.get('all');
        
        if (all === 'true') {
            const session = await auth();
            const userId = session?.user?.id ? Number(session.user.id) : null;
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            await prisma.notification.deleteMany({
                where: { userId }
            });
            return NextResponse.json({ success: true, cleared: true });
        }

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await prisma.notification.delete({
            where: { id: Number(id) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
