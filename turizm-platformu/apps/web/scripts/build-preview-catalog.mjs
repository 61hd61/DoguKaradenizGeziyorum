import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sourcePath = resolve(here, '../../../../veritabani/data/destinations.json')
const outDir = resolve(here, '../public/preview')
const imageBase = 'https://cdn.jsdelivr.net/gh/61hd61/DuguKaradenizGeziyorum@main/veritabani/'

function imageUrl(path) {
  if (!path || typeof path !== 'string') return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const clean = path.replace(/^\//, '')
  return imageBase + clean.split('/').map((part) => encodeURIComponent(part)).join('/')
}

const raw = JSON.parse(readFileSync(sourcePath, 'utf8'))
const data = (Array.isArray(raw) ? raw : [])
  .filter((row) => row && row.isActive !== false && row.id && row.latitude != null && row.longitude != null)
  .map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    shortDescription: row.shortDescription ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    thumbnailUrl: imageUrl(row.thumbnailUrl),
    images: Array.isArray(row.images) ? row.images.map(imageUrl).filter(Boolean) : [],
    provinceId: row.provinceId,
    typeId: row.typeId,
    type: {
      id: row.typeId,
      name: row.type_name ?? '',
      slug: null,
      color: null,
      icon: null,
    },
    province: {
      id: row.provinceId,
      name: row.province_name ?? '',
    },
  }))

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'catalog.json'), JSON.stringify({ success: true, data }))
console.log(`preview catalog: ${data.length} destinasyon`)
