import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import DestinationMarkers from '../components/DestinationMarkers'
import WeatherWidget from '../components/WeatherWidget'
import { useTour } from '../context/TourContext'
import { useWeatherTheme } from '../context/WeatherThemeContext'
import {
  PREVIEW_SERVER_NOTE,
  assetUrl,
  filterCatalog,
  loadPreviewCatalog,
  loadPreviewSample,
  provincesFrom,
  routerBase,
  typesFrom,
} from '../lib/previewCatalog'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const KARADENIZ_CENTER: [number, number] = [40.95, 39.5]
const DEFAULT_ZOOM = 8

const TILE_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  topo: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
  satellite: {
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
} as const

type LayerKey = keyof typeof TILE_LAYERS

interface NamedRef {
  id: string
  name: string
}

interface Destination {
  id: string
  name: string
  latitude: number
  longitude: number
  typeName: string
  typeSlug?: string | null
  typeIcon?: string | null
  provinceName: string
  typeColor?: string | null
  description?: string | null
  shortDescription?: string | null
  thumbnailUrl?: string | null
  images?: string[] | null
}

interface ApiListResponse<T> {
  success?: boolean
  data?: T
  meta?: { total?: number }
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : NaN
}

function isKaradenizCoord(lat: number, lon: number) {
  return lat >= 39 && lat <= 43 && lon >= 36 && lon <= 43.5
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mapDestination(raw: Record<string, unknown>): Destination | null {
  const latitude = toNumber(raw.latitude)
  const longitude = toNumber(raw.longitude)
  if (!raw.id || Number.isNaN(latitude) || Number.isNaN(longitude)) return null
  if (!isKaradenizCoord(latitude, longitude)) return null
  const type = raw.type as { name?: string; slug?: string; color?: string; icon?: string } | undefined
  const province = raw.province as NamedRef | undefined
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'İsimsiz'),
    latitude,
    longitude,
    typeName: type?.name ?? String(raw.type ?? ''),
    typeSlug: type?.slug ?? null,
    typeIcon: type?.icon ?? null,
    provinceName: province?.name ?? String(raw.province ?? ''),
    typeColor: type?.color ?? null,
    description: (raw.description as string | null | undefined) ?? null,
    shortDescription: (raw.shortDescription as string | null | undefined) ?? null,
    thumbnailUrl: (raw.thumbnailUrl as string | null | undefined) ?? null,
    images: Array.isArray(raw.images) ? (raw.images as string[]) : null,
  }
}

function imageSrc(path?: string | null) {
  return assetUrl(path)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function MapResize() {
  const map = useMap()
  useEffect(() => {
    const fix = () => map.invalidateSize()
    fix()
    const t1 = window.setTimeout(fix, 50)
    const t2 = window.setTimeout(fix, 300)
    window.addEventListener('resize', fix)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', fix)
    }
  }, [map])
  return null
}

function FitBounds({ destinations }: { destinations: Destination[] }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (destinations.length === 0) {
      map.setView(KARADENIZ_CENTER, DEFAULT_ZOOM)
      return
    }
    const bounds = L.latLngBounds(destinations.map((d) => [d.latitude, d.longitude] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
  }, [destinations, map])
  return null
}

function UserLocationLayer({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (!position) return
    const marker = L.circleMarker(position, { radius: 8, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8 })
    marker.addTo(map)
    return () => {
      marker.remove()
    }
  }, [position, map])
  return null
}

export default function MapPage() {
  const { t } = useTranslation()
  const { stops } = useTour()
  const { refresh: refreshWeather } = useWeatherTheme()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [provinceId, setProvinceId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [nearbyKm, setNearbyKm] = useState('')
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [layerKey, setLayerKey] = useState<LayerKey>('osm')
  const [provinces, setProvinces] = useState<NamedRef[]>([])
  const [types, setTypes] = useState<NamedRef[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingPreview, setUsingPreview] = useState(false)
  const [sampleLinks, setSampleLinks] = useState<{ username: string; displayName: string; destinationId: string; destinationName: string } | null>(null)
  const [lastRevision, setLastRevision] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    loadPreviewSample()
      .then((sample) => {
        if (!cancelled) setSampleLinks(sample.highlights)
      })
      .catch(() => {
        if (!cancelled) setSampleLinks(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadLists() {
      try {
        const [provinceRes, typeRes] = await Promise.all([
          fetch('/api/v1/destinations/provinces').then((res) => res.json() as Promise<ApiListResponse<NamedRef[]>>),
          fetch('/api/v1/destinations/types').then((res) => res.json() as Promise<ApiListResponse<NamedRef[]>>),
        ])
        if (!Array.isArray(provinceRes.data) || !Array.isArray(typeRes.data)) throw new Error('list')
        if (cancelled) return
        setProvinces(provinceRes.data)
        setTypes(typeRes.data)
      } catch {
        try {
          const rows = await loadPreviewCatalog()
          if (cancelled) return
          setProvinces(provincesFrom(rows))
          setTypes(typesFrom(rows))
          setUsingPreview(true)
        } catch {
          if (!cancelled) setError('İl ve tür listesi yüklenemedi.')
        }
      }
    }
    void loadLists()
    return () => {
      cancelled = true
    }
  }, [])

  const loadDestinations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: '2000', page: '1' })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (provinceId) params.set('provinceId', provinceId)
    if (typeId) params.set('typeId', typeId)
    try {
      const res = await fetch(`/api/v1/destinations?${params.toString()}`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const body = (await res.json()) as ApiListResponse<Record<string, unknown>[]>
      const mapped = (body.data ?? []).map(mapDestination).filter((d): d is Destination => d !== null)
      setDestinations(mapped)
      setTotal(body.meta?.total ?? mapped.length)
      setUsingPreview(false)
    } catch {
      try {
        const rows = filterCatalog(await loadPreviewCatalog(), {
          search: debouncedSearch,
          provinceId,
          typeId,
        })
        const mapped = rows
          .map((row) => mapDestination(row as unknown as Record<string, unknown>))
          .filter((d): d is Destination => d !== null)
        setDestinations(mapped)
        setTotal(mapped.length)
        setUsingPreview(true)
        setError(null)
      } catch {
        setDestinations([])
        setTotal(0)
        setUsingPreview(false)
        setError(
          'Destinasyonlar alınamadı. Önce destinasyon\\baslat.bat veya turizm-platformu\\start_all.bat ile API (port 3000) ve web (5173) açık olmalı.',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, provinceId, typeId])

  useEffect(() => {
    void loadDestinations()
  }, [loadDestinations])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/v1/sync/events')
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as { revision?: string }
          const rev = String(payload.revision ?? '')
          if (lastRevision && rev && rev !== lastRevision) void loadDestinations()
          if (rev) setLastRevision(rev)
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* SSE desteklenmiyorsa sessiz */
    }
    return () => es?.close()
  }, [lastRevision, loadDestinations])

  const filteredByNearby = useMemo(() => {
    if (!nearbyKm || !userPos) return destinations
    const km = Number(nearbyKm)
    if (!Number.isFinite(km) || km <= 0) return destinations
    return destinations.filter((d) => haversineKm(userPos[0], userPos[1], d.latitude, d.longitude) <= km)
  }, [destinations, nearbyKm, userPos])

  const markerDestinations = useMemo(() => {
    return filteredByNearby.map((dest) => {
      const imgs = (dest.images?.length ? dest.images : dest.thumbnailUrl ? [dest.thumbnailUrl] : [])
        .slice(0, 3)
        .map((img) => imageSrc(img))
        .filter(Boolean)
      const imgHtml = imgs.map((src) => `<img src="${src}" alt="" style="max-height:72px;width:100%;object-fit:cover;margin-top:6px;border-radius:4px" />`).join('')
      const popupHtml = `<div style="min-width:160px;font-size:13px">
        <strong>${escapeHtml(dest.name)}</strong>
        <div>${escapeHtml(dest.typeName)} · ${escapeHtml(dest.provinceName)}</div>
        ${dest.shortDescription ? `<p style="margin:4px 0;font-size:12px;color:#475569">${escapeHtml(dest.shortDescription.slice(0, 120))}</p>` : ''}
        ${imgHtml}
        <p style="margin-top:8px"><a href="${routerBase()}/destinasyon/${dest.id}">Detay →</a></p>
      </div>`
      return {
        id: dest.id,
        name: dest.name,
        latitude: dest.latitude,
        longitude: dest.longitude,
        typeName: dest.typeName,
        provinceName: dest.provinceName,
        typeColor: dest.typeColor,
        typeSlug: dest.typeSlug,
        typeIcon: dest.typeIcon,
        popupHtml,
      }
    })
  }, [filteredByNearby])

  function locateMe() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(p)
        void refreshWeather(p[0], p[1])
        if (!nearbyKm) setNearbyKm('25')
      },
      () => setError('Konum izni verilmedi.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const statusText = useMemo(() => {
    if (loading) return t('loading')
    if (error) return error
    const base = `${filteredByNearby.length} konum${total > filteredByNearby.length ? ` / ${total}` : ''}`
    if (nearbyKm && userPos) return `${base} · ${nearbyKm} km yarıçap`
    return base
  }, [loading, error, filteredByNearby.length, total, nearbyKm, userPos, t])

  const tile = TILE_LAYERS[layerKey]

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t('allProvinces')}</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t('allTypes')}</option>
              {types.map((typ) => (
                <option key={typ.id} value={typ.id}>
                  {typ.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={layerKey}
              onChange={(e) => setLayerKey(e.target.value as LayerKey)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              aria-label={t('mapLayer')}
            >
              {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.name}
                </option>
              ))}
            </select>
            <select
              value={nearbyKm}
              onChange={(e) => setNearbyKm(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              aria-label={t('nearby')}
            >
              <option value="">{t('nearby')} — kapalı</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
            <button type="button" onClick={locateMe} className="rounded-md border border-slate-300 px-3 py-1 text-sm">
              {t('myLocation')}
            </button>
            <Link to="/tur" className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white">
              {t('navTour')} ({stops.length})
            </Link>
          </div>
          <p className={`text-sm ${error ? 'text-red-600' : 'text-slate-600'}`}>{statusText}</p>
          {usingPreview ? <p className="text-sm text-slate-500">{PREVIEW_SERVER_NOTE}</p> : null}
          {sampleLinks ? (
            <p className="text-sm text-slate-700">
              Örnek kayıtlar:{' '}
              <Link to={`/profil/${sampleLinks.username}`} className="text-emerald-800 underline">
                {sampleLinks.displayName}
              </Link>
              {' · '}
              <Link to={`/destinasyon/${sampleLinks.destinationId}`} className="text-emerald-800 underline">
                {sampleLinks.destinationName} yorumları
              </Link>
              {' · '}
              <Link to="/tur" className="text-emerald-800 underline">
                hazır turlar
              </Link>
              {' · '}
              <Link to="/yonetim" className="text-emerald-800 underline">
                yönetim
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      <div className="relative min-h-[480px] w-full flex-1 bg-slate-200">
        <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
          <WeatherWidget />
        </div>
        <MapContainer
          center={KARADENIZ_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="z-0 h-full w-full"
          style={{ height: '100%', width: '100%', minHeight: 480 }}
        >
          <TileLayer attribution={tile.attribution} url={tile.url} />
          <MapResize />
          <FitBounds destinations={filteredByNearby} />
          <UserLocationLayer position={userPos} />
          <DestinationMarkers
            destinations={markerDestinations}
            onMarkerClick={(id) => {
              void fetch(`/api/v1/destinations/item/${id}/click`, { method: 'POST' })
            }}
          />
        </MapContainer>
      </div>
    </div>
  )
}
