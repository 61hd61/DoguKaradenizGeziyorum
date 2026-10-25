const DB_NAME = 'turizm_offline'
const STORE = 'pending_reviews'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface PendingReview {
  id?: number
  destinationId: string
  content: string
  rating: number
  category: string
  createdAt: string
}

export async function queueReview(review: Omit<PendingReview, 'id' | 'createdAt'>) {
  const db = await openDb()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ...review, createdAt: new Date().toISOString() })
    tx.oncomplete = () => resolve(1)
    tx.onerror = () => reject(tx.error)
  })
}

export async function listPendingReviews(): Promise<PendingReview[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as PendingReview[])
    req.onerror = () => reject(req.error)
  })
}

export async function removePendingReview(id: number) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function flushPendingReviews(token: string) {
  const pending = await listPendingReviews()
  for (const item of pending) {
    if (item.id == null) continue
    const res = await fetch(`/api/v1/destinations/item/${item.destinationId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content: item.content,
        rating: item.rating,
        category: item.category,
      }),
    })
    if (res.ok) await removePendingReview(item.id)
  }
}
