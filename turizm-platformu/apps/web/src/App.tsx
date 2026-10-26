import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import UserLayout from './layouts/UserLayout'
import AdminPage from './pages/AdminPage'
import DestinationPage from './pages/DestinationPage'
import EmailVerifyPage from './pages/EmailVerifyPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import TourPage from './pages/TourPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/destinasyon/:key" element={<DestinationPage />} />
        <Route path="/tur" element={<TourPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/profil/:username" element={<ProfilePage />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
        <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />
        <Route path="/eposta-dogrula" element={<EmailVerifyPage />} />
      </Route>

      <Route path="/yonetim" element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
      </Route>

      <Route path="/admin" element={<Navigate to="/yonetim" replace />} />
      <Route path="/admin/*" element={<Navigate to="/yonetim" replace />} />
    </Routes>
  )
}

export default App
