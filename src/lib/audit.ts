import { prisma } from '@/lib/prisma';

export async function createAuditLog(
  userId: number,
  action: string,
  entity: string,
  entityId: string,
  details?: any
) {
  try {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!exists) {
      const fallback = await prisma.user.findFirst({ select: { id: true }, orderBy: { id: 'asc' } })
      if (!fallback) return
      userId = fallback.id
    }
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details || {},
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
