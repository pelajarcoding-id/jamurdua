
import webpush from 'web-push';
import { prisma } from '@/lib/prisma'

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@sarakan.com',
    publicKey,
    privateKey
  );
}

export const sendPushNotification = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string }
) => {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    const anyErr = error as any
    const statusCode = Number(anyErr?.statusCode)
    const endpoint = String(anyErr?.endpoint || subscription?.endpoint || '')

    if (statusCode === 404 || statusCode === 410) {
      try {
        if (endpoint) {
          await (prisma as any).pushSubscription.deleteMany({ where: { endpoint } })
        }
      } catch {}
    }

    console.error('Error sending push notification:', {
      statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
      endpoint: endpoint || undefined,
      body: anyErr?.body,
    });
    return false;
  }
};
