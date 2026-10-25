import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/** Gmail, Outlook, Yahoo, iCloud, Hotmail, kurumsal ve alt alan adları. */
function isValidEmail(email: string): boolean {
  const normalized = email.trim()
  if (normalized.length < 5 || normalized.length > 254) return false
  return /^[^\s@]+@([^\s@]+\.)+[^\s@]{2,}$/i.test(normalized)
}

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]$|^[a-z0-9]{3,50}$/.test(username)
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(false)

  const [loginId, setLoginId] = useState('')
  const [loginPass, setLoginPass] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setMessageOk(false)
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: loginId.trim(), password: loginPass }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error?.message || 'Giriş başarısız')
      return
    }
    localStorage.setItem('turizm_token', body.data.accessToken)
    localStorage.setItem('turizm_user', JSON.stringify(body.data.user))
    navigate('/profil')
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setMessageOk(false)

    const mail = email.trim().toLowerCase()
    const user = normalizeUsername(username)

    if (!isValidEmail(mail)) {
      setMessage(
        'Geçerli bir e-posta girin. Gmail, Outlook, Hotmail, Yahoo, iCloud ve kurumsal adresler kabul edilir (ör. ad.soyad@gmail.com, isim@firma.com.tr).',
      )
      return
    }
    if (!isValidUsername(user)) {
      setMessage('Kullanıcı adı 3–50 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir.')
      return
    }
    if (password.length < 6) {
      setMessage('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== password2) {
      setMessage('Şifreler eşleşmiyor')
      return
    }

    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: user,
        email: mail,
        password,
      }),
    })
    const body = await res.json()
    if (!res.ok) {
      setMessage(body.error?.message || 'Kayıt başarısız')
      return
    }
    if (body.data.requiresEmailVerification) {
      setMessageOk(true)
      setMessage(body.data.message || 'Kayıt alındı. E-postanızdaki doğrulama bağlantısına tıklayın.')
      return
    }
    localStorage.setItem('turizm_token', body.data.accessToken)
    localStorage.setItem('turizm_user', JSON.stringify(body.data.user))
    setMessageOk(true)
    setMessage('Kayıt tamam. Profilinize yönlendiriliyorsunuz…')
    setTimeout(() => navigate('/profil'), 800)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        <button
          type="button"
          className={`flex-1 rounded py-2 text-sm ${mode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setMode('login')}
        >
          Giriş
        </button>
        <button
          type="button"
          className={`flex-1 rounded py-2 text-sm ${mode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setMode('register')}
        >
          Kayıt ol
        </button>
      </div>

      {message ? (
        <p className={`mt-4 text-sm ${messageOk ? 'text-emerald-700' : 'text-red-600'}`}>{message}</p>
      ) : null}

      {mode === 'login' ? (
        <form onSubmit={onLogin} className="mt-6 space-y-3">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="E-posta veya @kullaniciadi"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Şifre"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
          />
          <button type="submit" className="w-full rounded bg-emerald-600 py-2 text-white">
            Giriş yap
          </button>
          <p className="text-center text-sm">
            <Link to="/sifremi-unuttum" className="text-emerald-700 underline">
              Şifremi / kullanıcı adımı unuttum
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={onRegister} className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Ad"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Soyad"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Kullanıcı adı (ör. hakan_yilmaz)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="text"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="E-posta (Gmail, Outlook, Hotmail, …)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500">
            Tüm yaygın posta sağlayıcıları desteklenir; adres otomatik küçük harfe çevrilir.
          </p>
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Şifre (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Şifre tekrar"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="w-full rounded bg-emerald-600 py-2 text-white">
            Kayıt ol
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/" className="text-emerald-700 underline">
          Haritaya dön
        </Link>
      </p>
    </div>
  )
}
