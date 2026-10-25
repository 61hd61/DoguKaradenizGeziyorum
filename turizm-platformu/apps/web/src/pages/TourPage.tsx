import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { useTour } from '../context/TourContext'
import { useWeatherTheme } from '../context/WeatherThemeContext'
import 'leaflet/dist/leaflet.css'

interface PopularRoute {
  id: string
  name: string
  description?: string
  usageCount?: number
}

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    map.fitBounds(positions, { padding: [40, 40] })
  }, [positions, map])
  return null
}

export default function TourPage() {
  const { t } = useTranslation()
  const { stops, removeStop, clearStops } = useTour()
  const { packing, refresh } = useWeatherTheme()
  const [popular, setPopular] = useState<PopularRoute[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [participants, setParticipants] = useState('SOLO')
  const [vehicle, setVehicle] = useState('CAR')
  const [prefs, setPrefs] = useState<string[]>([])
  const [suggested, setSuggested] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/tours/popular-routes')
      .then((r) => r.json())
      .then((body) => setPopular(body.data ?? []))
      .catch(() => setPopular([]))
  }, [])

  const routeLine = useMemo(
    () => stops.map((s) => [s.latitude, s.longitude] as [number, number]),
    [stops],
  )

  useEffect(() => {
    if (stops[0]) void refresh(stops[0].latitude, stops[0].longitude)
  }, [stops, refresh])

  function runWizard() {
    const days =
      startDate && endDate
        ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
        : 1
    const count = Math.min(stops.length, Math.max(2, days * 2))
    setSuggested(
      `${participants} · ${vehicle} · ${prefs.join(', ') || 'genel'} — önerilen ${count} durak, ${days} gün. Popüler güzergahlardan biri: ${popular[0]?.name ?? 'Karadeniz kıyı hattı'}.`,
    )
    setWizardOpen(false)
  }

  const osrmUrl =
    routeLine.length >= 2
      ? `https://router.project-osrm.org/route/v1/driving/${routeLine.map(([lat, lon]) => `${lon},${lat}`).join(';')}?overview=full&geometries=geojson`
      : null

  const [osrmLine, setOsrmLine] = useState<[number, number][]>([])

  useEffect(() => {
    if (!osrmUrl) {
      setOsrmLine([])
      return
    }
    fetch(osrmUrl)
      .then((r) => r.json())
      .then((data) => {
        const coords = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined
        if (coords) setOsrmLine(coords.map(([lon, lat]) => [lat, lon]))
        else setOsrmLine(routeLine)
      })
      .catch(() => setOsrmLine(routeLine))
  }, [osrmUrl, routeLine])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('tourTitle')}</h1>
      <p className="mt-1 text-sm text-slate-600">{stops.length} destinasyon seçili</p>

      {packing.length > 0 ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm">
          {t('packing')}: {packing.join(' · ')}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
          onClick={() => setWizardOpen(true)}
        >
          {t('suggestTour')}
        </button>
        <button type="button" className="rounded border px-4 py-2 text-sm" disabled={stops.length < 2}>
          {t('drawRoute')} {stops.length >= 2 ? '' : '(en az 2 durak)'}
        </button>
        {stops.length > 0 ? (
          <button type="button" className="text-sm text-red-600 underline" onClick={clearStops}>
            Listeyi temizle
          </button>
        ) : null}
      </div>

      {wizardOpen ? (
        <div className="mt-4 space-y-2 rounded-lg border bg-white p-4 text-sm">
          <label className="block">
            Başlangıç
            <input type="date" className="ml-2 rounded border px-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            Bitiş
            <input type="date" className="ml-2 rounded border px-2" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <select className="rounded border px-2 py-1" value={participants} onChange={(e) => setParticipants(e.target.value)}>
            <option value="SOLO">Yalnız</option>
            <option value="FAMILY">Aile</option>
            <option value="FRIENDS">Arkadaşlar</option>
          </select>
          <select className="ml-2 rounded border px-2 py-1" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="CAR">Otomobil</option>
            <option value="BUS">Otobüs</option>
            <option value="BIKE">Bisiklet</option>
            <option value="WALK">Yaya</option>
          </select>
          <div className="flex flex-wrap gap-2 pt-2">
            {['Doğa', 'Tarih', 'Müze', 'Şelale', 'Göl', 'Kültür'].map((p) => (
              <label key={p} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={prefs.includes(p)}
                  onChange={(e) =>
                    setPrefs((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))
                  }
                />
                {p}
              </label>
            ))}
          </div>
          <button type="button" className="rounded bg-slate-900 px-3 py-1 text-white" onClick={runWizard}>
            Tur oluştur
          </button>
        </div>
      ) : null}

      {suggested ? <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">{suggested}</p> : null}

      <ol className="mt-6 space-y-2">
        {stops.map((s, i) => (
          <li key={s.id} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
            <span>
              {i + 1}. {s.name} <span className="text-slate-500">({s.typeName})</span>
            </span>
            <button type="button" className="text-red-600" onClick={() => removeStop(s.id)}>
              Sil
            </button>
          </li>
        ))}
      </ol>

      {stops.length === 0 ? (
        <p className="mt-6 text-slate-500">
          Haritadan destinasyon ekleyin.{' '}
          <Link to="/" className="text-emerald-700 underline">
            Harita
          </Link>
        </p>
      ) : null}

      {routeLine.length >= 2 ? (
        <div className="mt-8 h-80 overflow-hidden rounded-lg border">
          <MapContainer center={routeLine[0]} zoom={9} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitRoute positions={osrmLine.length ? osrmLine : routeLine} />
            <Polyline positions={osrmLine.length ? osrmLine : routeLine} color="#059669" weight={4} />
          </MapContainer>
        </div>
      ) : null}

      {popular.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-medium">Popüler güzergahlar</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {popular.map((r) => (
              <li key={r.id}>
                {r.name} {r.usageCount != null ? `(${r.usageCount} kullanım)` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
