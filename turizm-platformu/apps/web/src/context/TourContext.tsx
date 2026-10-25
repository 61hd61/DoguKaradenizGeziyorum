import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface TourStop {
  id: string
  name: string
  latitude: number
  longitude: number
  typeName?: string
}

interface TourContextValue {
  stops: TourStop[]
  addStop: (stop: TourStop) => void
  removeStop: (id: string) => void
  clearStops: () => void
  reorder: (from: number, to: number) => void
}

const TourContext = createContext<TourContextValue | null>(null)

const STORAGE_KEY = 'turizm_tour_stops'

function loadInitial(): TourStop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TourStop[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [stops, setStops] = useState<TourStop[]>(loadInitial)

  const addStop = useCallback((stop: TourStop) => {
    setStops((prev) => {
      if (prev.some((s) => s.id === stop.id)) return prev
      const next = [...prev, stop]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeStop = useCallback((id: string) => {
    setStops((prev) => {
      const next = prev.filter((s) => s.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clearStops = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setStops([])
  }, [])

  const reorder = useCallback((from: number, to: number) => {
    setStops((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      if (!item) return prev
      next.splice(to, 0, item)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ stops, addStop, removeStop, clearStops, reorder }),
    [stops, addStop, removeStop, clearStops, reorder],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour requires TourProvider')
  return ctx
}
