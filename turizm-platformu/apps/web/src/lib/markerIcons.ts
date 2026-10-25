/** Tür slug / ad → harita simgesi (emoji). Veritabanındaki icon alanı önceliklidir. */
const SLUG_ICON: Record<string, string> = {
  kilise: '⛪',
  cami: '🕌',
  turbe: '🛐',
  sapel: '⛪',
  kale: '🏰',
  'tarihi-bina': '🏛️',
  tarihi_bina: '🏛️',
  han: '🏨',
  hamam: '🧖',
  selale: '💧',
  kopru: '🌉',
  sivil_mimari: '🏘️',
  magara: '🕳️',
  'milli-park': '🌲',
  milli_park: '🌲',
  muze: '🏺',
  senlikler: '🎭',
  gol: '🏞️',
  kanyon: '⛰️',
  yerlesim: '🏡',
  cesme: '⛲',
  degirmen: '⚙️',
  koy: '🛖',
  antik: '🏺',
  anit: '🗿',
  kultur_evi: '🎎',
  medrese: '📚',
  kaymakamlik: '🏢',
  okul: '🏫',
  bahce_kapisi: '🚪',
  kaya_mezari: '⚰️',
  kayaustu: '🪨',
  kayalik: '🧗',
  toprak_alti: '🕳️',
  yamac: '🏔️',
  arkeolojik: '🔍',
}

const NAME_ICON: Record<string, string> = {
  kilise: '⛪',
  cami: '🕌',
  türbe: '🛐',
  turbe: '🛐',
  şapel: '⛪',
  sapel: '⛪',
  kale: '🏰',
  müze: '🏺',
  muze: '🏺',
  şelale: '💧',
  selale: '💧',
  göl: '🏞️',
  gol: '🏞️',
  köprü: '🌉',
  kopru: '🌉',
  'milli park': '🌲',
  mağara: '🕳️',
  magara: '🕳️',
  han: '🏨',
  hamam: '🧖',
}

function normalizeKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '_')
}

export function resolveTypeMarkerIcon(opts: {
  slug?: string | null
  name?: string | null
  icon?: string | null
}): string {
  const dbIcon = (opts.icon || '').trim()
  if (dbIcon && dbIcon.length <= 4 && !/^\d+$/.test(dbIcon)) return dbIcon

  const slug = normalizeKey(opts.slug || '')
  if (slug && SLUG_ICON[slug]) return SLUG_ICON[slug]

  const nameKey = normalizeKey(opts.name || '')
  if (nameKey && SLUG_ICON[nameKey]) return SLUG_ICON[nameKey]

  const nameLower = (opts.name || '').trim().toLowerCase()
  for (const [part, emoji] of Object.entries(NAME_ICON)) {
    if (nameLower.includes(part)) return emoji
  }

  return '📍'
}

export function typeMarkerDivIcon(emoji: string, borderColor?: string | null) {
  const border = borderColor && /^#[0-9a-f]{3,8}$/i.test(borderColor) ? borderColor : '#059669'
  return `
    <div class="turizm-type-marker" style="border-color:${border}">
      <span aria-hidden="true">${emoji}</span>
    </div>
  `
}
