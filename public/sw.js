// public/sw.js
// Service Worker for Cautio PWA - Offline Support

const CACHE_NAME = 'cautio-v1'
const OFFLINE_URL = '/offline'

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/technician',
  '/login',
  '/offline',
  '/cautio_shield.webp',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
]

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore cache failures for external resources
      })
    })
  )
  self.skipWaiting()
})

// Activate - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip Supabase API calls (always need network)
  if (url.hostname.includes('supabase.co')) return

  // Skip Cloudinary calls
  if (url.hostname.includes('cloudinary.com')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed - try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Background sync for pending uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-photos') {
    event.waitUntil(syncPendingPhotos())
  }
})

async function syncPendingPhotos() {
  // This would sync any photos taken offline
  // Implementation depends on IndexedDB storage
  console.log('Syncing pending photos...')
}
