import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export type AllowedRole = 'ADMIN' | 'PEMILIK' | 'MANAGER' | 'MANDOR' | 'KASIR' | 'GUDANG' | 'KEUANGAN' | 'SUPIR' | 'KARYAWAN'

export async function getAuthUser() {
  const session = await auth()
  const idRaw = session?.user?.id
  const roleRaw = session?.user?.role
  const id = idRaw ? Number(idRaw) : null
  const role = String(roleRaw || '').toUpperCase() as AllowedRole
  return { session, id: Number.isFinite(id) ? id : null, role }
}

export async function requireAuth() {
  const { session, id, role } = await getAuthUser()
  if (!session?.user?.id || !id) {
    return { session: null as any, id: null as any, role: '' as AllowedRole, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, id, role, response: null as any }
}

export async function requireRole(roles: AllowedRole[]) {
  const r = await requireAuth()
  if (r.response) return r
  if (!roles.includes(r.role)) {
    return { ...r, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return r
}

