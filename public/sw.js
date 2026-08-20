const CACHE_NAME = 'biblebell-shell-v8-final'
const BASE = '/BibleBell/'
const PRECACHE = [
  BASE,
  `${BASE}manifest.webmanifest`,
  `${BASE}content/questions.json`,
  `${BASE}icons/biblebell-192.png`,
  `${BASE}icons/biblebell-512.png`,
  `${BASE}icons/biblebell.ico`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request, fallbackRequest) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      void caches.open(CACHE_NAME).then((cache) => cache.put(fallbackRequest ?? request, copy))
    }
    return response
  } catch {
    return (await caches.match(fallbackRequest ?? request)) || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  if (url.pathname.includes('/api/')) return

  // 문제 데이터는 새 배포를 우선 읽고, 오프라인일 때만 마지막 캐시를 사용합니다.
  if (url.pathname === `${BASE}content/questions.json`) {
    event.respondWith(networkFirst(request))
    return
  }

  // 앱 문서와 JS/CSS는 온라인일 때 항상 최신 배포를 먼저 사용합니다.
  // 이전 PWA 캐시가 새 수정사항을 오래 붙잡는 문제를 피하면서 오프라인 캐시는 유지합니다.
  if (
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(
      request.mode === 'navigate'
        ? networkFirst(request, BASE)
        : networkFirst(request)
    )
    return
  }

  // 아이콘/샘플 이미지는 캐시 우선으로 가볍게 사용하고, 없으면 네트워크에서 채웁니다.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
