import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTour } from '../context/TourContext'
import { queueReview } from '../lib/offlineReviews'
import { translateUiText } from '../lib/autoTranslate'
import { PREVIEW_SERVER_NOTE, assetUrl, findInCatalog, loadPreviewCatalog } from '../lib/previewCatalog'

interface DestinationDetail {
  id: string
  name: string
  slug: string
  description?: string | null
  shortDescription?: string | null
  latitude: number
  longitude: number
  images?: string[] | null
  thumbnailUrl?: string | null
  averageRating?: number | null
  reviewCount?: number | null
  type?: { name?: string; color?: string }
  province?: { name?: string }
}

interface ReviewRow {
  id: string
  rating: number
  content: string
  category: string
  username: string
  createdAt?: string
}

function imageSrc(path?: string | null) {
  return assetUrl(path)
}

const CATEGORIES = [
  { value: 'FAMILY', label: 'Aile ile' },
  { value: 'ADULT', label: 'Yetişkin ile' },
  { value: 'SOLO', label: 'Yalnız' },
  { value: 'FRIENDS', label: 'Arkadaşlarla' },
]

export default function DestinationPage() {
  const { key } = useParams<{ key: string }>()
  const { t } = useTranslation()
  const { addStop } = useTour()
  const [dest, setDest] = useState<DestinationDetail | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewCat, setReviewCat] = useState('SOLO')
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    if (!key) return
    setError(null)
    setPreviewMode(false)
    fetch(`/api/v1/destinations/item/${encodeURIComponent(key)}`)
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) {
          const err = new Error(body.error?.message || 'Bulunamadı') as Error & { status?: number }
          err.status = r.status
          throw err
        }
        const data = body.data as DestinationDetail
        if (data.shortDescription) {
          data.shortDescription = await translateUiText(data.shortDescription)
        }
        setDest(data)
        void fetch(`/api/v1/destinations/item/${body.data.id}/click`, { method: 'POST' })
      })
      .catch(async (e: Error & { status?: number }) => {
        if (e.status && e.status < 500) {
          setError(e.message)
          return
        }
        try {
          const found = findInCatalog(await loadPreviewCatalog(), key)
          if (!found) throw new Error('Bulunamadı')
          setDest({
            id: found.id,
            name: found.name,
            slug: found.slug,
            description: found.description,
            shortDescription: found.shortDescription,
            latitude: found.latitude,
            longitude: found.longitude,
            images: found.images,
            thumbnailUrl: found.thumbnailUrl,
            type: found.type?.name ? { name: found.type.name, color: found.type.color ?? undefined } : undefined,
            province: found.province?.name ? { name: found.province.name } : undefined,
          })
          setPreviewMode(true)
        } catch (fallback) {
          setError(fallback instanceof Error ? fallback.message : 'Bulunamadı')
        }
      })
  }, [key])

  useEffect(() => {
    if (!dest?.id) return
    fetch(`/api/v1/destinations/item/${dest.id}/reviews`)
      .then((r) => r.json())
      .then((body) => setReviews(body.data ?? []))
      .catch(() => setReviews([]))
  }, [dest?.id])

  async function submitReview(e: FormEvent) {
    e.preventDefault()
    setReviewMsg(null)
    const token = localStorage.getItem('turizm_token')
    if (!token || !dest) {
      setReviewMsg('Yorum için giriş yapın.')
      return
    }
    if (!navigator.onLine) {
      await queueReview({
        destinationId: dest.id,
        content: reviewText,
        rating: reviewRating,
        category: reviewCat,
      })
      setReviewText('')
      setReviewMsg('Çevrimdışı kaydedildi. İnternet gelince gönderilecek.')
      return
    }
    const res = await fetch(`/api/v1/destinations/item/${dest.id}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: reviewText, rating: reviewRating, category: reviewCat }),
    })
    const body = await res.json()
    if (!res.ok) {
      if (!res.status || res.status >= 500) {
        await queueReview({
          destinationId: dest.id,
          content: reviewText,
          rating: reviewRating,
          category: reviewCat,
        })
        setReviewMsg('Sunucuya ulaşılamadı — yorum cihazda kuyruğa alındı.')
        return
      }
      setReviewMsg(body.error?.message || 'Gönderilemedi')
      return
    }
    setReviewText('')
    setReviews((prev) => [{ ...body.data, username: 'siz' }, ...prev])
    setReviewMsg('Yorum kaydedildi.')
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-red-600">{error}</p>
        <Link to="/" className="text-emerald-700 underline">
          Harita
        </Link>
      </div>
    )
  }

  if (!dest) {
    return <p className="p-8 text-center text-slate-500">{t('loading')}</p>
  }

  const imgs = dest.images?.length ? dest.images : dest.thumbnailUrl ? [dest.thumbnailUrl] : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="text-sm text-emerald-700 underline">
        ← Harita
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{dest.name}</h1>
      <p className="text-sm text-slate-600">
        {dest.type?.name} · {dest.province?.name}
        {dest.reviewCount != null ? ` · ${dest.reviewCount} yorum` : ''}
      </p>
      {dest.shortDescription ? <p className="mt-2 text-slate-700">{dest.shortDescription}</p> : null}
      {dest.description ? <p className="mt-4 whitespace-pre-wrap text-slate-800">{dest.description}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        {imgs.slice(0, 9).map((img) =>
          imageSrc(img) ? (
            <img key={img} src={imageSrc(img)!} alt={dest.name} className="h-32 w-full rounded object-cover" />
          ) : null,
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
          onClick={() =>
            addStop({
              id: dest.id,
              name: dest.name,
              latitude: dest.latitude,
              longitude: dest.longitude,
              typeName: dest.type?.name,
            })
          }
        >
          {t('addToTour')}
        </button>
        <Link to="/tur" className="rounded border border-slate-300 px-4 py-2 text-sm">
          {t('navTour')}
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t('reviews')}</h2>
        {previewMode ? <p className="mt-2 text-sm text-slate-500">{PREVIEW_SERVER_NOTE}</p> : null}
        <ul className="mt-3 space-y-3 text-sm">
          {reviews.map((r) => (
            <li key={r.id} className="rounded border border-slate-200 bg-white p-3">
              <div className="font-medium">
                @{r.username} · {r.rating}/5 · {r.category}
              </div>
              <p className="text-slate-700">{r.content}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={submitReview} className="mt-6 space-y-2 rounded-lg border bg-white p-4">
          <h3 className="font-medium">{t('writeReview')}</h3>
          {reviewMsg ? <p className="text-sm text-slate-600">{reviewMsg}</p> : null}
          <select
            className="w-full rounded border px-2 py-1 text-sm"
            value={reviewCat}
            onChange={(e) => setReviewCat(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={5}
            className="w-24 rounded border px-2 py-1 text-sm"
            value={reviewRating}
            onChange={(e) => setReviewRating(Number(e.target.value))}
            aria-label={t('rating')}
          />
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={3}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            required
            minLength={3}
          />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            Gönder
          </button>
        </form>
      </section>
    </div>
  )
}
