import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PREVIEW_SERVER_NOTE } from '../lib/previewCatalog'

interface Overview {
  destinations: number
  provinces: number
  types: number
  users: number
  reviews: number
  posts: number
  tours: number
  byProvince: { name: string; count: number }[]
}

interface AdminUserRow {
  id: string
  username: string
  email: string
  firstName?: string
  lastName?: string
  passwordHashPreview: string
  createdAt?: string
}

interface ReviewRow {
  id: string
  rating: number
  content: string
  username: string
  destination: string
  createdAt?: string
}

interface Analytics {
  clicks: number
  topDestinations: { name: string; viewCount?: number; reviewCount?: number; province?: string }[]
  popularRoutes: { name: string; usageCount?: number }[]
}

interface AdminDestinationRow {
  id: string
  name: string
  slug: string
  shortDescription?: string
  description?: string
  province?: string
  type?: string
  isFeatured?: boolean
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('turizm_admin_token'))
  const [email, setEmail] = useState('admin@turizm.local')
  const [password, setPassword] = useState('admin123')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [data, setData] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [destRows, setDestRows] = useState<AdminDestinationRow[]>([])
  const [destSearch, setDestSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editShort, setEditShort] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [apiOk, setApiOk] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/v1/admin/overview')
      .then(async (r) => {
        setApiOk(r.ok)
        const body = await r.json()
        if (body.data) setData(body.data)
        else if (!r.ok) setError('Özet alınamadı')
      })
      .catch(() => {
        setApiOk(false)
        setError(PREVIEW_SERVER_NOTE)
      })
  }, [])

  useEffect(() => {
    if (!adminToken) return
    const headers = { Authorization: `Bearer ${adminToken}` }
    Promise.all([
      fetch('/api/v1/admin/users', { headers }).then((r) => r.json()),
      fetch('/api/v1/admin/reviews', { headers }).then((r) => r.json()),
      fetch('/api/v1/admin/analytics', { headers }).then((r) => r.json()),
      fetch('/api/v1/admin/destinations?limit=40', { headers }).then((r) => r.json()),
    ]).then(([uRes, rRes, aRes, dRes]) => {
      if (uRes.data) setUsers(uRes.data)
      if (rRes.data) setReviews(rRes.data)
      if (aRes.data) setAnalytics(aRes.data)
      if (dRes.data) setDestRows(dRes.data)
    })
  }, [adminToken])

  async function reloadDestinations() {
    if (!adminToken) return
    const headers = { Authorization: `Bearer ${adminToken}` }
    const q = destSearch.trim() ? `&search=${encodeURIComponent(destSearch.trim())}` : ''
    const res = await fetch(`/api/v1/admin/destinations?limit=40${q}`, { headers })
    const body = await res.json()
    if (body.data) setDestRows(body.data)
  }

  async function saveDestination(id: string) {
    if (!adminToken) return
    await fetch(`/api/v1/admin/destinations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: editName, shortDescription: editShort }),
    })
    setEditId(null)
    void reloadDestinations()
  }

  async function onAdminLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)
    let res: Response
    try {
      res = await fetch('/api/v1/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      setLoginError(PREVIEW_SERVER_NOTE)
      return
    }
    const body = await res.json().catch(() => null)
    if (!res.ok || !body) {
      setLoginError(body?.error?.message || PREVIEW_SERVER_NOTE)
      return
    }
    localStorage.setItem('turizm_admin_token', body.data.accessToken)
    setAdminToken(body.data.accessToken)
  }

  function logoutAdmin() {
    localStorage.removeItem('turizm_admin_token')
    setAdminToken(null)
    setUsers([])
    setReviews([])
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Yönetim paneli</h1>
      <p className="mt-2 text-sm text-slate-600">
        Destinasyon ekleme/düzenleme: masaüstü{' '}
        <code className="rounded bg-slate-100 px-1">destinasyon\baslat-panel.bat</code> · Web özeti ve kullanıcı
        listesi burada.
      </p>

      {apiOk === false || error ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {error || 'Sunucular kapalı görünüyor.'}
          <ol className="mt-2 list-decimal pl-5">
            <li>PostgreSQL çalışsın (veritabanı: trabzon_turizm)</li>
            <li>
              <strong>destinasyon\baslat.bat</strong> ile API + web + paneli birlikte açın
            </li>
            <li>Tarayıcıda <strong>http://localhost:5173/yonetim</strong> sayfasını yenileyin</li>
          </ol>
        </div>
      ) : null}

      {!adminToken ? (
        <form onSubmit={onAdminLogin} className="mt-6 max-w-md space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-medium">Yönetici girişi</h2>
          <p className="text-xs text-slate-500">Varsayılan: admin@turizm.local / admin123 (ilk API açılışında oluşturulur)</p>
          {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
          <input
            type="email"
            className="w-full rounded border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Yönetici e-postası"
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
          />
          <button type="submit" className="w-full rounded bg-slate-900 py-2 text-sm text-white">
            Panele gir
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-emerald-700">Yönetici oturumu açık</span>
          <button type="button" onClick={logoutAdmin} className="text-sm text-slate-600 underline">
            Çıkış
          </button>
        </div>
      )}

      {data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Destinasyon', data.destinations],
            ['Kullanıcı', data.users],
            ['Yorum', data.reviews],
            ['Blog gönderisi', data.posts],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {adminToken && users.length > 0 ? (
        <div className="mt-8 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Kayıtlı kullanıcılar (şifre özetleri kriptolu)</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-2">@kullanıcı</th>
                <th className="py-2 pr-2">E-posta</th>
                <th className="py-2 pr-2">Ad</th>
                <th className="py-2">passwordHash (önizleme)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <Link to={`/profil/${u.username}`} className="text-emerald-700 underline">
                      @{u.username}
                    </Link>
                  </td>
                  <td className="py-2 pr-2">{u.email}</td>
                  <td className="py-2 pr-2">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="py-2 font-mono text-xs text-slate-600">{u.passwordHashPreview}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {adminToken ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Destinasyon düzenleme (web CRUD)</h2>
          <p className="text-xs text-slate-500">Tam görsel/import için masaüstü paneli kullanın; burada hızlı metin düzenleme yapılır.</p>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Ada göre ara"
              value={destSearch}
              onChange={(e) => setDestSearch(e.target.value)}
            />
            <button type="button" className="rounded bg-slate-800 px-3 py-1 text-sm text-white" onClick={() => void reloadDestinations()}>
              Ara
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {destRows.map((d) => (
              <li key={d.id} className="rounded border border-slate-100 p-2">
                {editId === d.id ? (
                  <div className="space-y-2">
                    <input className="w-full rounded border px-2 py-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={editShort}
                      onChange={(e) => setEditShort(e.target.value)}
                      placeholder="Kısa açıklama"
                    />
                    <div className="flex gap-2">
                      <button type="button" className="text-emerald-700 underline" onClick={() => void saveDestination(d.id)}>
                        Kaydet
                      </button>
                      <button type="button" className="text-slate-500" onClick={() => setEditId(null)}>
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between gap-2">
                    <span>
                      {d.name} <span className="text-slate-500">({d.province})</span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-emerald-700 underline"
                      onClick={() => {
                        setEditId(d.id)
                        setEditName(d.name)
                        setEditShort(d.shortDescription || '')
                      }}
                    >
                      Düzenle
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {adminToken && analytics ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Etkileşim analitiği (CTR / görüntülenme)</h2>
          <p className="mt-2 text-sm text-slate-600">Toplam tıklama kaydı: {analytics.clicks}</p>
          {analytics.topDestinations?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {analytics.topDestinations.map((d) => (
                <li key={d.name} className="flex justify-between border-b border-slate-100 py-1">
                  <span>
                    {d.name} {d.province ? `(${d.province})` : ''}
                  </span>
                  <span>
                    {d.viewCount ?? 0} görüntülenme · {d.reviewCount ?? 0} yorum
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {analytics.popularRoutes?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Popüler güzergahlar</h3>
              <ul className="mt-1 text-sm text-slate-600">
                {analytics.popularRoutes.map((r) => (
                  <li key={r.name}>
                    {r.name} — {r.usageCount ?? 0} kullanım
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {adminToken && reviews.length > 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Son yorumlar</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reviews.slice(0, 15).map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-2">
                <span className="font-medium">{r.destination}</span> · @{r.username} · {r.rating}/5
                <p className="text-slate-600">{r.content?.slice(0, 120)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data?.byProvince?.length ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">İllere göre destinasyon</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {data.byProvince.map((row) => (
              <li key={row.name} className="flex justify-between border-b border-slate-100 py-1">
                <span>{row.name}</span>
                <span>{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-sm text-slate-500">
        <Link to="/" className="text-emerald-700 underline">
          Haritaya dön
        </Link>
      </p>
    </div>
  )
}
