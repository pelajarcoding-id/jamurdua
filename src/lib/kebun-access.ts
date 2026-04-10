import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AllowedRole } from '@/lib/route-auth'

export async function getAccessibleKebunIds(userId: number, role: AllowedRole) {
  const r = String(role || '').toUpperCase() as AllowedRole
  if (r === 'ADMIN' || r === 'PEMILIK' || r === 'KASIR') return null as number[] | null

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { kebunId: true },
  })
  const directKebunId = userRow?.kebunId ?? null

  if (r === 'MANDOR') {
    return directKebunId ? [directKebunId] : []
  }

  if (r === 'MANAGER') {
    let assigned: number[] = []
    try {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>(
        Prisma.sql`SELECT "A" as id FROM "_UserKebuns" WHERE "B" = ${userId}`
      )
      assigned = rows.map(x => x.id).filter(Boolean)
    } catch {
      assigned = []
    }
    if (assigned.length > 0) return assigned
    return directKebunId ? [directKebunId] : []
  }

  return []
}

export async function ensureKebunAccess(userId: number, role: AllowedRole, kebunId: number) {
  const ids = await getAccessibleKebunIds(userId, role)
  if (ids === null) return true
  return ids.includes(kebunId)
}

