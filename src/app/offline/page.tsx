'use client'

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Anda sedang offline</h1>
        <p className="text-sm text-gray-600">
          Beberapa fitur mungkin tidak tersedia. Periksa koneksi internet Anda, lalu coba lagi.
        </p>
        <div className="mt-4">
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    </main>
  )
}

