import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallBanner() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => localStorage.getItem('turizm_pwa_dismiss') === '1')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (hidden || !deferred) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[5000] mx-auto flex max-w-md items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm shadow-lg md:left-auto">
      <span>{t('installPwa')}</span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="rounded bg-emerald-600 px-3 py-1 text-white"
          onClick={async () => {
            await deferred.prompt()
            setDeferred(null)
          }}
        >
          OK
        </button>
        <button
          type="button"
          className="text-slate-600 underline"
          onClick={() => {
            localStorage.setItem('turizm_pwa_dismiss', '1')
            setHidden(true)
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
