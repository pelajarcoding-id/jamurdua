'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const toastId = toast.loading('Mencoba masuk...')

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    toast.dismiss(toastId)

    if (result?.error) {
      if (result.error === 'CredentialsSignin') {
        toast.error('Email atau password salah.');
        setError('Email atau password salah.');
      } else {
        toast.error('Login gagal: ' + result.error);
        setError(result.error);
      }
    } else {
      toast.success('Login berhasil!');
      window.location.href = '/';
    }
  };



  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Alamat Email</label>
        <div className="mt-1">
          <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="input-style w-full" placeholder="anda@email.com" />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
        <div className="mt-1 relative">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="input-style w-full pr-10" placeholder="Password Anda" />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <div>
        <button type="submit" className="btn-primary w-full">
          Masuk
        </button>
      </div>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-blue-600 hover:underline">Lupa password?</Link>
      </div>
    </form>
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Selamat Datang</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Silakan masuk untuk melanjutkan</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
              <strong className="font-bold">Error!</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
          )}

          {renderLoginForm()}
        </div>
      </div>
    </main>
  )
}
