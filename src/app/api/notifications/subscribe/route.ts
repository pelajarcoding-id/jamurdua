
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const subscription = await request.json();
        const userId = parseInt(session.user.id);

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        await (prisma as any).pushSubscription.upsert({
            where: {
                userId_endpoint: {
                    userId,
                    endpoint: subscription.endpoint
                }
            },
            update: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                updatedAt: new Date()
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving subscription:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
