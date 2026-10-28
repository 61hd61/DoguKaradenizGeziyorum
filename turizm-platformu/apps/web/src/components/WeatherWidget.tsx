import { useTranslation } from 'react-i18next'
import { useWeatherTheme } from '../context/WeatherThemeContext'

const MOOD_LABEL: Record<string, string> = {
  sunny: 'Güneşli',
  rain: 'Yağmurlu',
  snow: 'Karlı',
  cloud: 'Bulutlu',
  windy: 'Rüzgarlı',
}

export default function WeatherWidget() {
  const { t } = useTranslation()
  const { temp, effectiveMood, packing } = useWeatherTheme()
  const mood = effectiveMood

  return (
    <div className="weather-widget rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="font-medium">
        {t('weatherWidget')}: {MOOD_LABEL[mood] ?? 'Bulutlu'}{' '}
        {temp != null ? `${Math.round(temp)}°C` : '—'}
      </div>
      {packing.length > 0 ? (
        <div className="mt-1 text-slate-600">
          {t('packing')}: {packing.slice(0, 3).join(', ')}
        </div>
      ) : null}
    </div>
  )
}
