export const PREVIEW_SERVER_NOTE =
  'Bu açık önizlemede giriş, yorum ve yönetim sunucusu yok. Harita ve destinasyonlar gezilebilir; hesap işlemleri için bilgisayarınızda TUMUNU-BASLAT.bat çalıştırın.'

export interface CatalogRecord {
  id: string
  name: string
  slug: string
  description?: string | null
  shortDescription?: string | null
  latitude: number
  longitude: number
  thumbnailUrl?: string | null
  images?: string[] | null
  provinceId?: string
  typeId?: string
  type?: { id?: string; name?: string; slug?: string | null; color?: string | null; icon?: string | null }
  province?: { id?: string; name?: string }
}

let cache: Promise<CatalogRecord[]> | null = null

export function routerBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '')
}

export function assetUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${clean}`
}

export function loadPreviewCatalog(): Promise<CatalogRecord[]> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}preview/catalog.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error('catalog')
        const body = (await res.json()) as { data?: CatalogRecord[] }
        return Array.isArray(body.data) ? body.data : []
      })
      .catch((err: unknown) => {
        cache = null
        throw err
      })
  }
  return cache
}

export function filterCatalog(
  rows: CatalogRecord[],
  opts: { search?: string; provinceId?: string; typeId?: string },
): CatalogRecord[] {
  const q = (opts.search ?? '').trim().toLocaleLowerCase('tr')
  return rows.filter((row) => {
    if (opts.provinceId && row.provinceId !== opts.provinceId && row.province?.id !== opts.provinceId) return false
    if (opts.typeId && row.typeId !== opts.typeId && row.type?.id !== opts.typeId) return false
    if (!q) return true
    const hay = [row.name, row.shortDescription, row.description, row.province?.name, row.type?.name]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('tr')
    return hay.includes(q)
  })
}

export function provincesFrom(rows: CatalogRecord[]): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const row of rows) {
    const id = row.province?.id || row.provinceId
    const name = row.province?.name
    if (id && name) map.set(id, name)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

export function typesFrom(rows: CatalogRecord[]): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const row of rows) {
    const id = row.type?.id || row.typeId
    const name = row.type?.name
    if (id && name) map.set(id, name)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

export function findInCatalog(rows: CatalogRecord[], key: string): CatalogRecord | undefined {
  const decoded = decodeURIComponent(key)
  return rows.find((row) => row.id === decoded || row.slug === decoded)
}
