export const LANGS = ['tr', 'en', 'ru', 'ar', 'de', 'fr'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_LABELS: Record<Lang, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  ar: 'العربية',
  de: 'Deutsch',
  fr: 'Français',
}

type Dict = Record<string, string>

const tr: Dict = {
  appTitle: 'Karadeniz Turizm',
  appSubtitle: 'Harita, tur planlama ve sosyal profil',
  navMap: 'Harita',
  navProfile: 'Profilim',
  navLogin: 'Giriş',
  navLogout: 'Çıkış',
  navAdmin: 'Yönetim',
  navTour: 'Turum',
  searchPlaceholder: 'Ada göre ara…',
  allProvinces: 'Tüm iller',
  allTypes: 'Tüm türler',
  nearby: 'Yakınımda',
  mapLayer: 'Harita katmanı',
  myLocation: 'Konumum',
  addToTour: "Tur'a ekle",
  detail: 'Detay',
  loading: 'Yükleniyor…',
  forgotPassword: 'Şifremi unuttum',
  tourTitle: 'Tur planlama',
  drawRoute: 'Rota çiz',
  suggestTour: 'Tur öner',
  weatherWidget: 'Hava durumu',
  packing: 'Çanta önerisi',
  reviews: 'Yorumlar',
  writeReview: 'Yorum yaz',
  rating: 'Puan',
  category: 'Kategori',
  installPwa: 'Uygulamayı yükle',
}

const en: Dict = {
  appTitle: 'Black Sea Tourism',
  appSubtitle: 'Map, tour planning and social profile',
  navMap: 'Map',
  navProfile: 'Profile',
  navLogin: 'Sign in',
  navLogout: 'Sign out',
  navAdmin: 'Admin',
  navTour: 'My tour',
  searchPlaceholder: 'Search by name…',
  allProvinces: 'All provinces',
  allTypes: 'All types',
  nearby: 'Near me',
  mapLayer: 'Map layer',
  myLocation: 'My location',
  addToTour: 'Add to tour',
  detail: 'Details',
  loading: 'Loading…',
  forgotPassword: 'Forgot password',
  tourTitle: 'Tour planning',
  drawRoute: 'Draw route',
  suggestTour: 'Suggest tour',
  weatherWidget: 'Weather',
  packing: 'Packing tips',
  reviews: 'Reviews',
  writeReview: 'Write review',
  rating: 'Rating',
  category: 'Category',
  installPwa: 'Install app',
}

const ru: Dict = { ...en, appTitle: 'Туризм Черноморья', navMap: 'Карта', navProfile: 'Профиль', navLogin: 'Вход' }
const de: Dict = { ...en, appTitle: 'Schwarzmeer-Tourismus', navMap: 'Karte', navProfile: 'Profil', navLogin: 'Anmelden' }
const fr: Dict = { ...en, appTitle: 'Tourisme Mer Noire', navMap: 'Carte', navProfile: 'Profil', navLogin: 'Connexion' }
const ar: Dict = {
  ...en,
  appTitle: 'سياحة البحر الأسود',
  navMap: 'الخريطة',
  navProfile: 'الملف',
  navLogin: 'دخول',
  navLogout: 'خروج',
  navTour: 'جولتي',
  searchPlaceholder: 'بحث بالاسم…',
}

export const resources: Record<Lang, Dict> = { tr, en, ru, ar, de, fr }

export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'tr'
  const raw = (navigator.language || 'tr').slice(0, 2).toLowerCase()
  if (LANGS.includes(raw as Lang)) return raw as Lang
  return 'tr'
}
