import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { detectLang, resources, type Lang } from './locales'

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, { translation: v }])),
  lng: typeof localStorage !== 'undefined' ? localStorage.getItem('turizm_lang') || detectLang() : 'tr',
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
})

export function setAppLang(lang: Lang) {
  localStorage.setItem('turizm_lang', lang)
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

setAppLang((i18n.language as Lang) || detectLang())

export default i18n
