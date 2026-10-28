export const PREVIEW_SERVER_NOTE =
  'Destinasyonlar gerçek kayıttır. Yorum, profil, blog ve tur listesi yapay kontrol verisidir; giriş sunucusu bu sayfada yoktur.'

export const PREVIEW_DEMO_TOKEN = 'preview-demo'

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

export interface SampleUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  bio: string
  followers: number
  following: number
  posts: number
  createdAt?: string
}

export interface SamplePost {
  id: string
  userId: string
  username: string
  title: string
  content: string
  likeCount?: number
  commentCount?: number
  createdAt?: string
}

export interface SampleReview {
  id: string
  destinationId: string
  destinationName: string
  username: string
  rating: number
  category: string
  content: string
  createdAt?: string
  sample?: boolean
}

export interface SampleRouteStop {
  id: string
  name: string
  latitude: number
  longitude: number
  typeName?: string
}

export interface SampleRoute {
  id: string
  name: string
  description?: string
  usageCount?: number
  averageRating?: number
  stops: SampleRouteStop[]
}

export interface PreviewSample {
  synthetic: boolean
  highlights: {
    username: string
    displayName: string
    destinationId: string
    destinationName: string
  }
  users: SampleUser[]
  posts: SamplePost[]
  reviews: SampleReview[]
  routes: SampleRoute[]
  admin: {
    overview: {
      destinations: number
      provinces: number
      types: number
      users: number
      reviews: number
      posts: number
      tours: number
      byProvince: { name: string; count: number }[]
    }
    users: {
      id: string
      username: string
      email: string
      firstName: string
      lastName: string
      passwordHashPreview: string
      createdAt?: string
    }[]
    reviews: {
      id: string
      rating: number
      content: string
      username: string
      destination: string
      createdAt?: string
    }[]
    analytics: {
      clicks: number
      topDestinations: { name: string; province?: string; viewCount?: number; reviewCount?: number }[]
      popularRoutes: { name: string; usageCount?: number }[]
    }
  }
}

let sampleCache: Promise<PreviewSample> | null = null

export function loadPreviewSample(): Promise<PreviewSample> {
  if (!sampleCache) {
    sampleCache = fetch(`${import.meta.env.BASE_URL}preview/sample.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error('sample')
        return (await res.json()) as PreviewSample
      })
      .catch((err: unknown) => {
        sampleCache = null
        throw err
      })
  }
  return sampleCache
}
