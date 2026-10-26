import { useMemo } from 'react'
import { useWeatherTheme } from '../context/WeatherThemeContext'

function rand(seed: number) {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

const FX_LAYER = 'weather-fx-layer pointer-events-none fixed inset-0 z-[15] overflow-hidden'

export default function WeatherEffects() {
  const { effectiveMood, windSpeed } = useWeatherTheme()
  const mood = effectiveMood

  const snowflakes = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: `${rand(i) * 100}%`,
        delay: `${rand(i + 1) * 4}s`,
        duration: `${3 + rand(i + 2) * 5}s`,
        size: 14 + Math.floor(rand(i + 3) * 18),
      })),
    [],
  )

  const raindrops = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        left: `${rand(i + 10) * 100}%`,
        delay: `${rand(i + 11) * 1.5}s`,
        duration: `${0.35 + rand(i + 12) * 0.35}s`,
      })),
    [],
  )

  const windStreaks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        top: `${rand(i + 20) * 100}%`,
        delay: `${rand(i + 21) * 3}s`,
        duration: `${0.8 + rand(i + 22) * 1.5}s`,
        width: 60 + Math.floor(rand(i + 23) * 160),
      })),
    [],
  )

  const cloudPuffs = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        top: `${10 + rand(i + 30) * 60}%`,
        delay: `${rand(i + 31) * 8}s`,
        duration: `${12 + rand(i + 32) * 10}s`,
        scale: 0.6 + rand(i + 33) * 1.2,
      })),
    [],
  )

  if (mood === 'snow') {
    return (
      <div className={`${FX_LAYER} weather-fx-snow`} aria-hidden>
        {snowflakes.map((f) => (
          <span
            key={f.id}
            className="weather-snowflake"
            style={{
              left: f.left,
              animationDelay: f.delay,
              animationDuration: f.duration,
              fontSize: f.size,
            }}
          >
            ❄
          </span>
        ))}
      </div>
    )
  }

  if (mood === 'rain') {
    return (
      <div className={`${FX_LAYER} weather-fx-rain`} aria-hidden>
        {raindrops.map((d) => (
          <span
            key={d.id}
            className="weather-raindrop"
            style={{ left: d.left, animationDelay: d.delay, animationDuration: d.duration }}
          />
        ))}
      </div>
    )
  }

  if (mood === 'windy') {
    return (
      <div
        className={`${FX_LAYER} weather-fx-wind`}
        aria-hidden
        data-wind={windSpeed != null && windSpeed > 25 ? 'strong' : 'mild'}
      >
        {windStreaks.map((w) => (
          <span
            key={w.id}
            className="weather-wind-streak"
            style={{
              top: w.top,
              width: w.width,
              animationDelay: w.delay,
              animationDuration: w.duration,
            }}
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={`leaf-${i}`}
            className="weather-wind-leaf"
            style={{
              top: `${rand(i + 40) * 90}%`,
              animationDelay: `${rand(i + 41) * 2}s`,
              animationDuration: `${2 + rand(i + 42) * 2}s`,
            }}
          >
            🍃
          </span>
        ))}
      </div>
    )
  }

  if (mood === 'sunny') {
    return (
      <div className={`${FX_LAYER} weather-fx-sunny`} aria-hidden>
        <div className="weather-sun-disc" />
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="weather-sun-ray" style={{ transform: `rotate(${i * 60}deg)` }} />
        ))}
      </div>
    )
  }

  return (
    <div className={`${FX_LAYER} weather-fx-cloud`} aria-hidden>
      {cloudPuffs.map((c) => (
        <span
          key={c.id}
          className="weather-cloud-puff"
          style={{
            top: c.top,
            animationDelay: c.delay,
            animationDuration: c.duration,
            transform: `scale(${c.scale})`,
          }}
        >
          ☁
        </span>
      ))}
    </div>
  )
}
