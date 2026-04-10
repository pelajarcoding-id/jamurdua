import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'session'

export function signSession(payload: object) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function verifySessionToken(token: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  return jwt.verify(token, secret) as any
}

export function getSession() {
  const c = cookies()
  const token = c.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    return verifySessionToken(token)
  } catch {
    return null
  }
}

export function setSessionCookie(value: string) {
  const c = cookies()
  c.set({ name: COOKIE_NAME, value, httpOnly: true, path: '/', sameSite: 'lax' })
}

export function clearSessionCookie() {
  const c = cookies()
  c.set({ name: COOKIE_NAME, value: '', expires: new Date(0), path: '/' })
}

export function requireAuth(req: any) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    return verifySessionToken(token)
  } catch {
    return null
  }
}