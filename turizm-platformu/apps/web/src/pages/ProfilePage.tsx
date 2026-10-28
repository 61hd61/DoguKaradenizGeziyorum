import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadPreviewSample, PREVIEW_DEMO_TOKEN, type SampleUser } from '../lib/previewCatalog'

interface UserProfile {
  id: string
  username: string
  avatarUrl?: string | null
  firstName?: string
  lastName?: string
  bio?: string | null
  followers?: number
  following?: number
  posts?: number
}

interface PostItem {
  id: string
  title: string
  content: string
  images?: string[]
  likeCount?: number
  commentCount?: number
  createdAt?: string
}

function sessionUser(): { username?: string; id?: string } | null {
  const raw = localStorage.getItem('turizm_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as { username?: string; id?: string }
  } catch {
    return null
  }
}

export default function ProfilePage() {
  const { username } = useParams()
  const me = sessionUser()
  const target = username || me?.username || ''
  const isOwn = !username || (me?.username && me.username.toLowerCase() === target.toLowerCase())

  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'grid' | 'feed'>('feed')

  const [bioDraft, setBioDraft] = useState('')
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fromSample, setFromSample] = useState(false)
  const [directory, setDirectory] = useState<SampleUser[]>([])

  const token = localStorage.getItem('turizm_token')

  const displayName = useMemo(() => {
    if (!user) return ''
    const n = [user.firstName, user.lastName].filter(Boolean).join(' ')
    return n || user.username
  }, [user])

  async function showSampleProfile(name: string) {
    const sample = await loadPreviewSample()
    const found = sample.users.find((item) => item.username.toLowerCase() === name.toLowerCase())
    if (!found) {
      setFromSample(false)
      setUser(null)
      setPosts([])
      setError('Kullanıcı bulunamadı')
      return
    }
    setFromSample(true)
    setError(null)
    setUser({
      id: found.id,
      username: found.username,
      firstName: found.firstName,
      lastName: found.lastName,
      bio: found.bio,
      followers: found.followers,
      following: found.following,
      posts: found.posts,
    })
    setBioDraft(found.bio || '')
    setPosts(sample.posts.filter((post) => post.userId === found.id))
  }

  function reloadProfile() {
    if (!target) return
    Promise.all([
      fetch(`/api/v1/social/users/${encodeURIComponent(target)}`).then((r) => r.json()),
      fetch(`/api/v1/social/users/${encodeURIComponent(target)}/posts`).then((r) => r.json()),
    ])
      .then(async ([userRes, postsRes]) => {
        if (userRes.data) {
          setFromSample(false)
          setUser(userRes.data)
          setBioDraft(userRes.data.bio || '')
          setPosts(Array.isArray(postsRes.data) ? postsRes.data : [])
          setError(null)
          return
        }
        await showSampleProfile(target)
      })
      .catch(() => {
        void showSampleProfile(target).catch(() => setError('Profil yüklenemedi'))
      })
  }

  useEffect(() => {
    if (!target) {
      setError(null)
      setUser(null)
      loadPreviewSample()
        .then((sample) => setDirectory(sample.users))
        .catch(() => setDirectory([]))
      return
    }
    reloadProfile()
  }, [target])

  async function saveBio(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (token === PREVIEW_DEMO_TOKEN) {
      setUser((current) => (current ? { ...current, bio: bioDraft } : current))
      return
    }
    setSaving(true)
    await fetch('/api/v1/social/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bio: bioDraft }),
    })
    setSaving(false)
    reloadProfile()
  }

  async function publishPost(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (token === PREVIEW_DEMO_TOKEN) {
      setPosts((current) => [
        { id: `yerel-${Date.now()}`, title: postTitle || 'Başlıksız not', content: postContent, likeCount: 0, commentCount: 0 },
        ...current,
      ])
      setPostTitle('')
      setPostContent('')
      return
    }
    setSaving(true)
    const res = await fetch('/api/v1/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: postTitle, content: postContent }),
    })
    setSaving(false)
    if (res.ok) {
      setPostTitle('')
      setPostContent('')
      reloadProfile()
    }
  }

  async function followUser() {
    if (!token || !target) {
      alert('Takip etmek için giriş yapın.')
      return
    }
    const res = await fetch(`/api/v1/social/users/${encodeURIComponent(target)}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (res.ok) {
      alert(`@${target} takip edildi. Yeni paylaşımlarda bildirim (ödev.txt) sonraki fazda eklenecek.`)
      reloadProfile()
    } else {
      alert(body.error?.message || 'Takip edilemedi')
    }
  }

  if (!target) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold">Örnek gezginler</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu profiller ve paylaşımlar yapay kontrol verisidir. Destinasyon kayıtlarına dokunulmaz.
        </p>
        <ul className="mt-4 space-y-2">
          {directory.map((person) => (
            <li key={person.id}>
              <Link to={`/profil/${person.username}`} className="text-emerald-800 underline">
                {person.firstName} {person.lastName}
              </Link>
              <span className="text-sm text-slate-500"> @{person.username}</span>
            </li>
          ))}
        </ul>
        <Link to="/giris" className="mt-6 inline-block rounded bg-emerald-600 px-4 py-2 text-white">
          Örnek hesapla gir
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="h-32 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600" />
      <div className="relative px-4">
        <div className="-mt-14 flex items-end gap-4">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-400 to-teal-600 text-3xl font-bold text-white shadow-lg">
            {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
          </div>
          <div className="mb-2 flex-1">
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-slate-600">@{user?.username || target}</p>
          </div>
        </div>

        {error ? <p className="mt-4 text-red-600">{error}</p> : null}

        {user ? (
          <>
            {fromSample ? (
              <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Örnek profil ve paylaşımlar.</p>
            ) : null}
            {user.bio && !isOwn ? <p className="mt-4 text-sm leading-relaxed">{user.bio}</p> : null}

            <div className="mt-4 flex gap-8 text-center text-sm">
              <div>
                <div className="text-lg font-semibold">{user.posts ?? posts.length}</div>
                <div className="text-slate-500">gönderi</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{user.followers ?? 0}</div>
                <div className="text-slate-500">takipçi</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{user.following ?? 0}</div>
                <div className="text-slate-500">takip</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {isOwn ? (
                <span className="flex-1 rounded-md border border-slate-300 py-2 text-center text-sm font-medium text-slate-600">
                  Kişisel blog sayfanız
                </span>
              ) : (
                <button
                  type="button"
                  onClick={followUser}
                  className="flex-1 rounded-md bg-slate-900 py-2 text-sm font-medium text-white"
                >
                  Takip et
                </button>
              )}
              {!isOwn ? (
                <p className="self-center text-xs text-slate-500">Blog sayfanız ziyaret ediliyor</p>
              ) : null}
            </div>

            {isOwn && token ? (
              <form onSubmit={saveBio} className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <label className="text-sm font-medium">Biyografi (herkese açık)</label>
                <textarea
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                  rows={3}
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="Hatıralarınız, gezi notları…"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 rounded bg-emerald-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Kaydet
                </button>
              </form>
            ) : null}

            {isOwn && token ? (
              <form onSubmit={publishPost} className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-medium">Yeni gönderi</h2>
                <input
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                  placeholder="Başlık (ör. Uzungöl gezisi)"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                />
                <textarea
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Fotoğraf ve görüşlerinizi yazın…"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Paylaş
                </button>
              </form>
            ) : null}

            <div className="mt-6 flex border-b border-slate-200 text-sm">
              <button
                type="button"
                className={`flex-1 py-2 ${tab === 'feed' ? 'border-b-2 border-slate-900 font-semibold' : 'text-slate-500'}`}
                onClick={() => setTab('feed')}
              >
                Akış
              </button>
              <button
                type="button"
                className={`flex-1 py-2 ${tab === 'grid' ? 'border-b-2 border-slate-900 font-semibold' : 'text-slate-500'}`}
                onClick={() => setTab('grid')}
              >
                Izgara
              </button>
            </div>

            {posts.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-500">
                Henüz paylaşım yok. {isOwn ? 'İlk hatıranızı yukarıdan ekleyin.' : ''}
              </p>
            ) : tab === 'grid' ? (
              <div className="mt-4 grid grid-cols-3 gap-1">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square bg-gradient-to-br from-slate-200 to-slate-300 p-2 text-xs font-medium text-slate-700"
                    title={post.title}
                  >
                    {post.images?.[0] ? (
                      <img src={post.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="line-clamp-4">{post.content}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {posts.map((post) => (
                  <article key={post.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                        {(user.username[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{displayName}</div>
                        <div className="text-xs text-slate-500">@{user.username}</div>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <h3 className="font-medium">{post.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.content}</p>
                    </div>
                    <div className="flex gap-4 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                      <span>{post.likeCount ?? 0} beğeni</span>
                      <span>{post.commentCount ?? 0} yorum</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
