import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type WeatherMood = 'sunny' | 'rain' | 'snow' | 'cloud' | 'windy'

interface WeatherData {
  temp: number | null
  mood: WeatherMood
  windSpeed: number | null
  packing: string[]
}

interface WeatherThemeContextValue extends WeatherData {
  /** API'den gelen gerçek mood */
  apiMood: WeatherMood
  /** demoMood ?? apiMood — efektler buna göre */
  effectiveMood: WeatherMood
  demoMood: WeatherMood | null
  setDemoMood: (m: WeatherMood | null) => void
  refresh: (lat?: number, lon?: number) => Promise<void>
}

const WeatherThemeContext = createContext<WeatherThemeContextValue | null>(null)

const DEFAULT: WeatherData = { temp: null, mood: 'cloud', windSpeed: null, packing: [] }

const DEMO_PARAM: Record<string, WeatherMood> = {
  kar: 'snow',
  snow: 'snow',
  yagmur: 'rain',
  rain: 'rain',
  ruzgar: 'windy',
  wind: 'windy',
  windy: 'windy',
  gunes: 'sunny',
  sun: 'sunny',
  sunny: 'sunny',
  bulut: 'cloud',
  cloud: 'cloud',
}

export function WeatherThemeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WeatherData>(DEFAULT)
  const [demoMood, setDemoMood] = useState<WeatherMood | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = new URLSearchParams(window.location.search).get('hava')?.toLowerCase()
    return raw ? DEMO_PARAM[raw] ?? null : null
  })

  const refresh = useCallback(async (lat = 40.99, lon = 39.72) => {
    try {
      const res = await fetch(`/api/v1/weather?lat=${lat}&lon=${lon}`)
      const body = await res.json()
      if (body.data) {
        setData({
          temp: body.data.temp ?? null,
          mood: body.data.mood ?? 'cloud',
          windSpeed: body.data.windSpeed ?? null,
          packing: body.data.packing ?? [],
        })
      }
    } catch {
      setData(DEFAULT)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), 5 * 60 * 1000)
    return () => window.clearInterval(t)
  }, [])

  const effectiveMood = demoMood ?? data.mood

  useEffect(() => {
    document.documentElement.dataset.weather = effectiveMood
  }, [effectiveMood])

  const value = useMemo(
    () => ({
      ...data,
      apiMood: data.mood,
      effectiveMood,
      demoMood,
      setDemoMood,
      refresh,
    }),
    [data, effectiveMood, demoMood, refresh],
  )

  return <WeatherThemeContext.Provider value={value}>{children}</WeatherThemeContext.Provider>
}

export function useWeatherTheme() {
  const ctx = useContext(WeatherThemeContext)
  if (!ctx) throw new Error('useWeatherTheme requires WeatherThemeProvider')
  return ctx
}
