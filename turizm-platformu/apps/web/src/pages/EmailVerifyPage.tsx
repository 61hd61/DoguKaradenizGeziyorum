import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function EmailVerifyPage() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Doğrulanıyor…')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setMessage('Geçersiz bağlantı.')
      return
    }
    fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error?.message || 'Doğrulama başarısız')
        setOk(true)
        setMessage(body.data?.message || 'E-posta doğrulandı.')
      })
      .catch((e: Error) => setMessage(e.message))
  }, [params])

  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className={ok ? 'text-emerald-700' : 'text-slate-700'}>{message}</p>
      <Link to="/giris" className="mt-6 inline-block text-emerald-700 underline">
        Giriş yap
      </Link>
    </div>
  )
}
