/** Separate storage prevents library cleanup from deleting playlist artwork. */
const DB = 'lucent-playlist-covers'
let connection: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  return connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('covers')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { connection = null; reject(req.error) }
  })
}
async function write(id: string, image: Blob | null) {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('covers', 'readwrite')
    if (image) tx.objectStore('covers').put(image, id)
    else tx.objectStore('covers').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
export async function getPlaylistCover(id: string): Promise<Blob | null> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction('covers').objectStore('covers').get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}
export async function savePlaylistCover(id: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const size = Math.min(bitmap.width, bitmap.height)
    if (!size) throw new Error('Invalid image.')
    canvas.width = 600; canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is unavailable.')
    ctx.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 600, 600)
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88))
    if (!image) throw new Error('Could not process this image.')
    await write(id, image)
  } finally { bitmap.close() }
}
export const deletePlaylistCover = (id: string) => write(id, null)
