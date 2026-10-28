import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSelect from '../components/LanguageSelect'
import PwaInstallBanner from '../components/PwaInstallBanner'
import WeatherMoodPicker from '../components/WeatherMoodPicker'
import { useTour } from '../context/TourContext'

export default function UserLayout() {
  const { t } = useTranslation()
  const { stops } = useTour()
  const userRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('turizm_user') : null
  const user = userRaw ? (JSON.parse(userRaw) as { username?: string }) : null

  function logoutUser() {
    localStorage.removeItem('turizm_token')
    localStorage.removeItem('turizm_user')
    window.location.href = '/'
  }

  return (
    <div className="user-shell app-shell relative flex min-h-dvh flex-col text-slate-900">
      <header className="relative z-20 border-b shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{t('appTitle')}</h1>
            <p className="text-xs text-slate-500">{t('appSubtitle')}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <LanguageSelect />
            <WeatherMoodPicker />
            <NavLink to="/" className={({ isActive }) => (isActive ? 'font-semibold text-emerald-700' : 'text-slate-700')}>
              {t('navMap')}
            </NavLink>
            <NavLink
              to="/tur"
              className={({ isActive }) => (isActive ? 'font-semibold text-emerald-700' : 'text-slate-700')}
            >
              {t('navTour')}
              {stops.length > 0 ? (
                <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-xs text-white">{stops.length}</span>
              ) : null}
            </NavLink>
            <NavLink to="/profil" className={({ isActive }) => (isActive ? 'font-semibold text-emerald-700' : 'text-slate-700')}>
              {t('navProfile')}
            </NavLink>
            {user?.username ? (
              <>
                <span className="text-slate-600">@{user.username}</span>
                <button type="button" onClick={logoutUser} className="text-slate-600 underline">
                  {t('navLogout')}
                </button>
              </>
            ) : (
              <NavLink to="/giris" className={({ isActive }) => (isActive ? 'font-semibold text-emerald-700' : 'text-slate-700')}>
                {t('navLogin')}
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-0 flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </main>

      <footer className="relative z-20 border-t px-4 py-2 text-center text-xs text-slate-600">
        Destinasyon düzenleme: masaüstü <strong>destinasyon\baslat-panel.bat</strong>
        {' · '}
        <Link to="/" className="text-emerald-700 underline">
          Harita
        </Link>
      </footer>
      <PwaInstallBanner />
    </div>
  )
}
