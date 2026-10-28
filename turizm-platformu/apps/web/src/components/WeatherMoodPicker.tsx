import { useWeatherTheme, type WeatherMood } from '../context/WeatherThemeContext'

const OPTIONS: { value: '' | WeatherMood; label: string }[] = [
  { value: '', label: 'Hava: otomatik' },
  { value: 'snow', label: 'Kar' },
  { value: 'rain', label: 'Yağmur' },
  { value: 'windy', label: 'Rüzgar' },
  { value: 'sunny', label: 'Güneş' },
  { value: 'cloud', label: 'Bulut' },
]

export default function WeatherMoodPicker() {
  const { effectiveMood, demoMood, setDemoMood } = useWeatherTheme()

  return (
    <label className="flex items-center gap-1 text-xs">
      <select
        className="max-w-[9rem] rounded border border-slate-300 bg-white/90 px-1 py-0.5"
        value={demoMood ?? ''}
        onChange={(e) => setDemoMood((e.target.value || null) as WeatherMood | null)}
        title={`Görünen efekt: ${effectiveMood}`}
      >
        {OPTIONS.map((o) => (
          <option key={o.label} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
