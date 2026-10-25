import { useTranslation } from 'react-i18next'
import { setAppLang } from '../i18n'
import { LANG_LABELS, LANGS, type Lang } from '../i18n/locales'

export default function LanguageSelect() {
  const { i18n } = useTranslation()
  const current = (i18n.language?.slice(0, 2) as Lang) || 'tr'

  return (
    <select
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
      value={current}
      onChange={(e) => setAppLang(e.target.value as Lang)}
      aria-label="Language"
    >
      {LANGS.map((code) => (
        <option key={code} value={code}>
          {LANG_LABELS[code]}
        </option>
      ))}
    </select>
  )
}
