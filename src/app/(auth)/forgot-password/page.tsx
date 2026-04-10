'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Gagal mengirim')
      setSent(true)
      toast.success('Jika email terdaftar, tautan reset sudah dikirim.')
    } catch {
      toast.error('Gagal mengirim email reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lupa Password</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Masukkan email untuk menerima tautan reset</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Alamat Email</label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-style w-full"
                  placeholder="anda@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
              </button>
              {sent && (
                <div className="text-xs text-green-600 text-center">
                  Cek email Anda untuk melanjutkan reset password.
                </div>
              )}
            </div>
          </form>
          <div className="text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">Kembali ke login</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
