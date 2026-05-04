import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function dataUrlToFile(dataUrl: string, filename: string) {
  const parts = String(dataUrl || '').split(',')
  if (parts.length < 2) throw new Error('Format foto tidak valid')
  const mimeMatch = parts[0].match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export function formatIdNumber(value: number | string, maxFractionDigits: number = 0) {
  const num = typeof value === 'string' ? parseIdNumber(value) : value
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFractionDigits }).format(num || 0)
}

export function formatIdCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0)
}

export function parseIdNumber(value: string) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatIdThousands(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function parseIdThousandInt(value: unknown) {
  const raw = value == null ? '' : String(value)
  const normalized = raw.replace(/\./g, '').replace(/,/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}
