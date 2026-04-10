import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/web-push';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';

export const dynamic = 'force-dynamic'

// GET: Ambil daftar permintaan untuk kebun tertentu
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const permintaan = await (prisma as any).permintaanKebun.findMany({
      where: { kebunId },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(permintaan);
  } catch (error) {
    console.error('Error fetching permintaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data permintaan' },
      { status: 500 }
    );
  }
}

// POST: Buat permintaan baru
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json();
    const { title, description, priority, quantity, unit, imageUrl } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Judul permintaan wajib diisi' },
        { status: 400 }
      );
    }

    // Create Permintaan
    const newPermintaan = await (prisma as any).permintaanKebun.create({
      data: {
        kebunId,
        userId: guard.id,
        title,
        quantity: quantity ? parseFloat(quantity) : null,
        unit,
        description,
        imageUrl: imageUrl || null,
        priority: priority || 'NORMAL',
        status: 'PENDING'
      },
      include: {
        kebun: true,
        user: {
          select: { name: true }
        }
      }
    });

    // Send Notification to Admins and Owners
    try {
      const recipients = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'PEMILIK'] }
        },
        select: { id: true }
      });

      if (recipients.length > 0) {
        const quantityInfo = quantity ? ` (${quantity} ${unit || ''})` : '';
        const message = `${newPermintaan.user.name} membuat permintaan baru untuk ${newPermintaan.kebun.name}: "${title}"${quantityInfo}`;
        const url = `/kebun/${kebunId}?tab=permintaan`;

        await prisma.notification.createMany({
          data: recipients.map(recipient => ({
            userId: recipient.id,
            type: 'PERMINTAAN_KEBUN',
            title: 'Permintaan Baru dari Kebun',
            message,
            link: url
          }))
        });

        // Send Push Notifications
        const subscriptions = await (prisma as any).pushSubscription.findMany({
          where: {
            userId: { in: recipients.map(r => r.id) }
          }
        });

        await Promise.all(subscriptions.map((sub: any) => 
          sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            { title: 'Permintaan Baru', body: message, url }
          )
        ));
      }
    } catch (notifError) {
      console.error('Failed to send notifications:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json(newPermintaan);
  } catch (error) {
    console.error('Error creating permintaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal membuat permintaan' },
      { status: 500 }
    );
  }
}
