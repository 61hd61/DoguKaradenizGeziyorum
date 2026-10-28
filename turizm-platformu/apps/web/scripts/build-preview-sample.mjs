import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sourcePath = resolve(here, '../../../../veritabani/data/destinations.json')
const outDir = resolve(here, '../public/preview')

function fold(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replaceAll('â', 'a')
    .replaceAll('î', 'i')
    .replaceAll('û', 'u')
}

const PEOPLE = [
  ['ayse.yilmaz', 'Ayşe', 'Yılmaz', 'Trabzon’da yayla yürüyüşü ve göl kenarı notları tutarım.', 18, 7],
  ['mehmet.kaya', 'Mehmet', 'Kaya', 'Rize şelalelerini ve yağmurlu patika yollarını fotoğraflarım.', 24, 11],
  ['elif.demir', 'Elif', 'Demir', 'Manastır, kale ve eski köprü duraklarını ailemle gezerim.', 15, 9],
  ['can.ozturk', 'Can', 'Öztürk', 'Yayla yollarını otomobille, kısa etaplar halinde planlarım.', 31, 14],
  ['zeynep.arslan', 'Zeynep', 'Arslan', 'Sahil kasabaları ve yöresel pazarlar için kısa kaçamaklar yaparım.', 12, 6],
  ['emre.celik', 'Emre', 'Çelik', 'Tek başıma gittiğim noktalarda yürüyüş süresi ve manzara notu bırakırım.', 9, 4],
]

const REVIEW_LINES = [
  'Yürüyüş yolu bakımlıydı, öğleden sonra ışık fotoğraf için çok iyiydi.',
  'Hafta sonu kalabalık oluyor; erken saatte girmek rahat ettirdi.',
  'Yağmur sonrası patika kaygandı, yine de manzara beklediğim gibiydi.',
  'Aileyle geldik. Otopark dolunca biraz yürüdük ama yer görmeye değer.',
  'Çay molasını yakındaki köyde verdik, dönüş yolu da güzeldi.',
  'Tabelalar yeterli. Gün batımına yakın gitmek daha sakin.',
]

const POST_LINES = [
  'Bu durağı tura ekledim. Sabah erken çıkınca hem yol boştu hem sis dağılmadan yetiştim.',
  'Kısa not: su ve yağmurluk şart. Dönüşte aynı vadiden inmek bir saati geçmedi.',
]

const raw = JSON.parse(readFileSync(sourcePath, 'utf8'))
const destinations = (Array.isArray(raw) ? raw : []).filter(
  (row) => row && row.isActive !== false && row.id && row.name && row.latitude != null && row.longitude != null,
)

const needles = ['uzungol', 'sumela', 'ayder', 'palovit', 'pokut', 'firtina', 'karagol', 'caglayan']
const picked = []
const used = new Set()
for (const needle of needles) {
  const found = destinations.find((row) => !used.has(row.id) && fold(row.name).includes(needle))
  if (!found) continue
  used.add(found.id)
  picked.push(found)
}
if (picked.length < 4) {
  for (const row of destinations) {
    if (picked.length >= 8) break
    if (used.has(row.id)) continue
    used.add(row.id)
    picked.push(row)
  }
}

const users = PEOPLE.map((person, index) => ({
  id: `ornek-kullanici-${index + 1}`,
  username: person[0],
  email: `${person[0]}@ornek.turizm.local`,
  firstName: person[1],
  lastName: person[2],
  bio: person[3],
  followers: person[4],
  following: person[5],
  posts: 2,
  createdAt: `2026-10-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`,
}))

const posts = []
users.forEach((user, userIndex) => {
  const place = picked[userIndex % picked.length]
  POST_LINES.forEach((line, lineIndex) => {
    posts.push({
      id: `ornek-gonderi-${userIndex + 1}-${lineIndex + 1}`,
      userId: user.id,
      username: user.username,
      title: lineIndex === 0 ? `${place.name} notu` : `${place.province_name || 'Karadeniz'} dönüşü`,
      content: `${place.name} için örnek kayıt. ${line}`,
      likeCount: 3 + userIndex + lineIndex,
      commentCount: lineIndex,
      createdAt: `2026-10-${String(18 + userIndex).padStart(2, '0')}T${String(8 + lineIndex).padStart(2, '0')}:15:00.000Z`,
    })
  })
})

const categories = ['FAMILY', 'SOLO', 'FRIENDS', 'ADULT']
const reviews = []
picked.forEach((place, placeIndex) => {
  for (let i = 0; i < 2; i += 1) {
    const user = users[(placeIndex + i) % users.length]
    reviews.push({
      id: `ornek-yorum-${placeIndex + 1}-${i + 1}`,
      destinationId: place.id,
      destinationName: place.name,
      username: user.username,
      rating: 4 + ((placeIndex + i) % 2),
      category: categories[(placeIndex + i) % categories.length],
      content: `${place.name}: ${REVIEW_LINES[(placeIndex + i) % REVIEW_LINES.length]}`,
      createdAt: `2026-10-${String(12 + placeIndex).padStart(2, '0')}T${String(11 + i).padStart(2, '0')}:00:00.000Z`,
      sample: true,
    })
  }
})

function stopOf(place) {
  return {
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    typeName: place.type_name || '',
  }
}

const routeSlices = [
  [0, 3],
  [3, 6],
  [2, 6],
]
const routeNames = [
  'Yayla ve göl hattı',
  'Vadi ve şelale hattı',
  'Üç günlük doğu turu',
]
const routes = routeSlices
  .map((range, index) => {
    const stops = picked.slice(range[0], range[1]).map(stopOf)
    if (stops.length < 2) return null
    return {
      id: `ornek-tur-${index + 1}`,
      name: routeNames[index],
      description: `${stops.map((stop) => stop.name).join(' → ')}. Bu liste yapay kontrol verisidir; duraklar gerçek destinasyonlardır.`,
      usageCount: 40 - index * 9,
      averageRating: 4.6 - index * 0.2,
      stops,
    }
  })
  .filter(Boolean)

const provinceCounts = new Map()
for (const row of destinations) {
  const name = row.province_name || 'Bilinmeyen'
  provinceCounts.set(name, (provinceCounts.get(name) || 0) + 1)
}
const byProvince = [...provinceCounts.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'))

const reviewCountByName = new Map()
for (const review of reviews) {
  reviewCountByName.set(review.destinationName, (reviewCountByName.get(review.destinationName) || 0) + 1)
}

const sample = {
  synthetic: true,
  highlights: {
    username: users[0].username,
    displayName: `${users[0].firstName} ${users[0].lastName}`,
    destinationId: picked[0]?.id ?? '',
    destinationName: picked[0]?.name ?? '',
  },
  users,
  posts,
  reviews,
  routes,
  admin: {
    overview: {
      destinations: destinations.length,
      provinces: byProvince.length,
      types: new Set(destinations.map((row) => row.type_name).filter(Boolean)).size,
      users: users.length,
      reviews: reviews.length,
      posts: posts.length,
      tours: routes.length,
      byProvince,
    },
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      passwordHashPreview: 'örnek kayıt',
      createdAt: user.createdAt,
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      content: review.content,
      username: review.username,
      destination: review.destinationName,
      createdAt: review.createdAt,
    })),
    analytics: {
      clicks: 186,
      topDestinations: picked.slice(0, 6).map((place, index) => ({
        name: place.name,
        province: place.province_name || '',
        viewCount: 80 - index * 9,
        reviewCount: reviewCountByName.get(place.name) || 0,
      })),
      popularRoutes: routes.map((route) => ({ name: route.name, usageCount: route.usageCount })),
    },
  },
}

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'sample.json'), JSON.stringify(sample))
console.log(
  `preview sample: ${users.length} kullanıcı, ${posts.length} gönderi, ${reviews.length} yorum, ${routes.length} tur`,
)
