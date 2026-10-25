import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './App.css'
import LanguageSelect from './components/LanguageSelect'
import PwaInstallBanner from './components/PwaInstallBanner'
import AdminPage from './pages/AdminPage'
import DestinationPage from './pages/DestinationPage'
import EmailVerifyPage from './pages/EmailVerifyPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import TourPage from './pages/TourPage'
import { useTour } from './context/TourContext'

function App() {
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
    <div className="app-shell flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{t('appTitle')}</h1>
            <p className="text-xs text-slate-500">{t('appSubtitle')}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <LanguageSelect />
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
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'font-semibold text-emerald-700' : 'text-slate-700')}>
              {t('navAdmin')}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/destinasyon/:key" element={<DestinationPage />} />
          <Route path="/tur" element={<TourPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/profil/:username" element={<ProfilePage />} />
          <Route path="/giris" element={<LoginPage />} />
          <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
          <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />
          <Route path="/eposta-dogrula" element={<EmailVerifyPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
        Masaüstü destinasyon paneli:{' '}
        <Link to="/admin" className="underline">
          Web özet
        </Link>{' '}
        · Tam düzenleme için <strong>destinasyon\baslat-panel.bat</strong>
      </footer>
      <PwaInstallBanner />
    </div>
  )
}

export default App
