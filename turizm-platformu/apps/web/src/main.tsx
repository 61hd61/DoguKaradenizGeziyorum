import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './i18n'
import './index.css'
import App from './App.tsx'
import { TourProvider } from './context/TourContext'
import { WeatherThemeProvider } from './context/WeatherThemeContext'
import { flushPendingReviews } from './lib/offlineReviews'
import { routerBase } from './lib/previewCatalog'

window.addEventListener('online', () => {
  const token = localStorage.getItem('turizm_token')
  if (token) void flushPendingReviews(token)
})

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={routerBase()}>
    <WeatherThemeProvider>
      <TourProvider>
        <App />
      </TourProvider>
    </WeatherThemeProvider>
  </BrowserRouter>,
)
