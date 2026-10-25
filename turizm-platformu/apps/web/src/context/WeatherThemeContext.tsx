import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type WeatherMood = 'sunny' | 'rain' | 'snow' | 'cloud'

interface WeatherData {
  temp: number | null
  mood: WeatherMood
  packing: string[]
}

interface WeatherThemeContextValue extends WeatherData {
  refresh: (lat?: number, lon?: number) => Promise<void>
}

const WeatherThemeContext = createContext<WeatherThemeContextValue | null>(null)

const DEFAULT: WeatherData = { temp: null, mood: 'cloud', packing: [] }

export function WeatherThemeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WeatherData>(DEFAULT)

  const refresh = async (lat = 40.99, lon = 39.72) => {
    try {
      const res = await fetch(`/api/v1/weather?lat=${lat}&lon=${lon}`)
      const body = await res.json()
      if (body.data) {
        setData({
          temp: body.data.temp ?? null,
          mood: body.data.mood ?? 'cloud',
          packing: body.data.packing ?? [],
        })
      }
    } catch {
      setData(DEFAULT)
    }
  }

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), 15 * 60 * 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.weather = data.mood
  }, [data.mood])

  const value = useMemo(() => ({ ...data, refresh }), [data])

  return <WeatherThemeContext.Provider value={value}>{children}</WeatherThemeContext.Provider>
}

export function useWeatherTheme() {
  const ctx = useContext(WeatherThemeContext)
  if (!ctx) throw new Error('useWeatherTheme requires WeatherThemeProvider')
  return ctx
}
