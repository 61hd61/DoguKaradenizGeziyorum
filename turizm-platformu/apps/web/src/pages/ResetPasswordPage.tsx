import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 6) {
      setMessage('Şifre en az 6 karakter olmalı.')
      return
    }
    if (password !== password2) {
      setMessage('Şifreler eşleşmiyor.')
      return
    }
    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error?.message || 'Güncellenemedi')
      return
    }
    setOk(true)
    setMessage(body.data?.message || 'Şifre güncellendi.')
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-red-600">Geçersiz sıfırlama bağlantısı.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Yeni şifre</h1>
      {message ? <p className={`mt-4 text-sm ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{message}</p> : null}
      {!ok ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Yeni şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Tekrar"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" className="w-full rounded bg-emerald-600 py-2 text-white">
            Kaydet
          </button>
        </form>
      ) : (
        <Link to="/giris" className="mt-6 inline-block text-emerald-700 underline">
          Giriş yap
        </Link>
      )}
    </div>
  )
}
