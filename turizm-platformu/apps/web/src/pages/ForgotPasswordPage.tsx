import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setOk(false)
    const res = await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error?.message || 'İşlem başarısız')
      return
    }
    setOk(true)
    setMessage(body.data?.message || 'E-posta gönderildi (geliştirme ortamında token API logunda).')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">{t('forgotPassword')}</h1>
      <p className="mt-2 text-sm text-slate-600">Kayıtlı e-posta adresinizi girin.</p>
      {message ? <p className={`mt-4 text-sm ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{message}</p> : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          className="w-full rounded border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="w-full rounded bg-emerald-600 py-2 text-white">
          Sıfırlama bağlantısı iste
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/giris" className="text-emerald-700 underline">
          Girişe dön
        </Link>
      </p>
    </div>
  )
}
