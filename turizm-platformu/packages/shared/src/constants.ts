// Shared Constants
export const SUPPORTED_LANGUAGES = [
  { code: "tr", name: "Türkçe", nativeName: "Türkçe", flag: "🇹🇷", rtl: false },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", rtl: false },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", rtl: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", rtl: true },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", rtl: false },
] as const;

export const DEFAULT_LANGUAGE = "tr";

export const PROVINCES = [
  { id: "trabzon", name: "Trabzon", code: "61", lat: 41.0082, lon: 39.7269, zoom: 10 },
  { id: "giresun", name: "Giresun", code: "28", lat: 40.9128, lon: 38.3895, zoom: 10 },
  { id: "ordu", name: "Ordu", code: "52", lat: 40.9833, lon: 37.8833, zoom: 10 },
  { id: "gumushane", name: "Gümüşhane", code: "29", lat: 40.4603, lon: 39.4814, zoom: 10 },
  { id: "rize", name: "Rize", code: "53", lat: 41.0208, lon: 40.5219, zoom: 10 },
  { id: "artvin", name: "Artvin", code: "08", lat: 41.1819, lon: 41.8183, zoom: 10 },
] as const;

export const DESTINATION_TYPE_ICONS: Record<string, string> = {
  CAMI: "mosque",
  TURBE: "tomb",
  KILISE: "church",
  SAPEL: "chapel",
  KALE: "castle",
  TARIHI_BINA: "building",
  HAN: "warehouse",
  HAMAM: "bath",
  SELALE: "waterfall",
  KOPRU: "bridge",
  SIVIL_MIMARI: "architecture",
  MAGARA: "cave",
  MILLI_PARK: "park",
  MUZE: "museum",
  SENLIKLER: "festival",
  GOL: "lake",
  KANYON: "canyon",
  YERLESim: "settlement",
  CEshME: "fountain",
  DEGIRMEN: "mill",
  KOY: "village",
  ANTIK: "ruins",
  ANIT: "monument",
  KULTUR_EVI: "culture-house",
  MEDRESE: "madrasa",
  KAYMAKAMLIK: "government",
  OKUL: "school",
  BAHCE_KAPISI: "gate",
  KAYA_MEZARI: "rock-tomb",
  KAYAUSTU: "rock-top",
  KAYALIK: "rocky",
  TOPRAK_ALTI: "underground",
  YAMAC: "slope",
  ARKEOLOJIK: "archaeological",
};

export const DESTINATION_TYPE_COLORS: Record<string, string> = {
  CAMI: "#1e88e5",
  TURBE: "#8e24aa",
  KILISE: "#e53935",
  SAPEL: "#d81b60",
  KALE: "#6d4c41",
  TARIHI_BINA: "#5d4037",
  HAN: "#795548",
  HAMAM: "#00acc1",
  SELALE: "#00bcd4",
  KOPRU: "#43a047",
  SIVIL_MIMARI: "#fb8c00",
  MAGARA: "#757575",
  MILLI_PARK: "#43a047",
  MUZE: "#fdd835",
  SENLIKLER: "#ec407a",
  GOL: "#29b6f6",
  KANYON: "#8d6e63",
  YERLESim: "#616161",
  CEshME: "#26c6da",
  DEGIRMEN: "#9e9d24",
  KOY: "#8d6e63",
  ANTIK: "#546e7a",
  ANIT: "#ffb300",
  KULTUR_EVI: "#ab47bc",
  MEDRESE: "#6a1b9a",
  KAYMAKAMLIK: "#37474f",
  OKUL: "#1e88e5",
  BAHCE_KAPISI: "#8d6e63",
  KAYA_MEZARI: "#78909c",
  KAYAUSTU: "#90a4ae",
  KAYALIK: "#78909c",
  TOPRAK_ALTI: "#5d4037",
  YAMAC: "#a1887f",
  ARKEOLOJIK: "#546e7a",
};

export const REVIEW_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  tr: {
    FAMILY: "Aile ile",
    ADULT: "Yetişkin ile",
    SOLO: "Yalnız",
    FRIENDS: "Arkadaşlarla",
  },
  en: {
    FAMILY: "With Family",
    ADULT: "Adult Only",
    SOLO: "Solo",
    FRIENDS: "With Friends",
  },
  ru: {
    FAMILY: "С семьей",
    ADULT: "Только взрослые",
    SOLO: "В одиночку",
    FRIENDS: "С друзьями",
  },
  ar: {
    FAMILY: "مع العائلة",
    ADULT: "للبالغين فقط",
    SOLO: "وحدي",
    FRIENDS: "مع الأصدقاء",
  },
  de: {
    FAMILY: "Mit Familie",
    ADULT: "Nur Erwachsene",
    SOLO: "Allein",
    FRIENDS: "Mit Freunden",
  },
};

export const TOUR_PARTICIPANT_LABELS: Record<string, Record<string, string>> = {
  tr: { SOLO: "Yalnız", FAMILY: "Aile", FRIENDS: "Arkadaşlar" },
  en: { SOLO: "Solo", FAMILY: "Family", FRIENDS: "Friends" },
  ru: { SOLO: "В одиночку", FAMILY: "Семья", FRIENDS: "Друзья" },
  ar: { SOLO: "وحدي", FAMILY: "عائلة", FRIENDS: "أصدقاء" },
  de: { SOLO: "Allein", FAMILY: "Familie", FRIENDS: "Freunde" },
};

export const TOUR_VEHICLE_LABELS: Record<string, Record<string, string>> = {
  tr: { CAR: "Otomobil", BUS: "Otobüs", PUBLIC_TRANSPORT: "Toplu Taşıma", BICYCLE: "Bisiklet", WALKING: "Yaya" },
  en: { CAR: "Car", BUS: "Bus", PUBLIC_TRANSPORT: "Public Transport", BICYCLE: "Bicycle", WALKING: "Walking" },
  ru: { CAR: "Автомобиль", BUS: "Автобус", PUBLIC_TRANSPORT: "Общественный транспорт", BICYCLE: "Велосипед", WALKING: "Пешком" },
  ar: { CAR: "سيارة", BUS: "حافلة", PUBLIC_TRANSPORT: "النقل العام", BICYCLE: "دراجة", WALKING: "مشي" },
  de: { CAR: "Auto", BUS: "Bus", PUBLIC_TRANSPORT: "ÖPNV", BICYCLE: "Fahrrad", WALKING: "Zu Fuß" },
};

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
};

export const JWT_CONFIG = {
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "30d",
  issuer: "turizm-platformu",
  audience: "turizm-platformu-users",
};

export const RATE_LIMITS = {
  auth: { max: 5, windowMs: 60_000 }, // 5 requests per minute
  api: { max: 100, windowMs: 60_000 }, // 100 requests per minute
  upload: { max: 10, windowMs: 60_000 }, // 10 uploads per minute
};

export const FILE_UPLOAD = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
};

export const WEATHER_API = {
  baseUrl: "https://api.open-meteo.com/v1/forecast",
  cacheHours: 6,
};

export const TRANSLATION_API = {
  // LibreTranslate self-hosted or Google Cloud Translate
  baseUrl: process.env.LIBRETRANSLATE_URL || "https://libretranslate.de",
  cacheHours: 24,
};