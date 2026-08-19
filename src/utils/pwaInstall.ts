type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
})

export function isStandaloneApp(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function browserFlags() {
  const ua = navigator.userAgent
  const isMac = /Macintosh|Mac OS X/i.test(ua)
  const isWindows = /Windows/i.test(ua)
  const isWhale = /Whale\//i.test(ua)
  const isEdge = /Edg\//i.test(ua)
  const isChrome = /Chrome\//i.test(ua) && !isWhale && !isEdge
  const isSafari = /Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)
  return { isMac, isWindows, isWhale, isEdge, isChrome, isSafari }
}

export function getPwaInstallHelp(): string {
  const { isMac, isWindows, isWhale, isEdge, isChrome, isSafari } = browserFlags()

  if (isMac && isSafari) {
    return 'Mac Safari에서는 상단 메뉴의 “파일 → Dock에 추가”를 선택하세요. 설치 후 Dock/응용 프로그램에서 BibleBell 아이콘으로 실행할 수 있습니다.'
  }

  if (isEdge) {
    return isWindows
      ? 'Edge에서는 주소창의 앱 설치 아이콘을 누르거나 “⋯ → 앱 → 이 사이트를 앱으로 설치”를 선택하세요. 설치 후 시작 메뉴/앱 목록에서 BibleBell을 실행하고 필요하면 바탕화면 바로가기를 만들 수 있습니다.'
      : 'Edge에서는 주소창의 앱 설치 아이콘 또는 브라우저 메뉴의 “앱 설치”를 사용하세요.'
  }

  if (isWhale) {
    return 'Whale에서는 주소창 오른쪽의 설치 아이콘이 보이면 누르세요. 보이지 않으면 Whale 메뉴에서 현재 사이트의 앱/웹앱 설치 항목을 선택하세요.'
  }

  if (isChrome) {
    return isWindows
      ? 'Chrome에서는 주소창 오른쪽의 설치 아이콘을 누르세요. 아이콘이 없으면 Chrome 메뉴에서 “페이지를 앱으로 설치” 또는 “앱 설치” 항목을 선택하세요.'
      : 'Chrome에서는 주소창 오른쪽의 설치 아이콘을 누르세요. 아이콘이 없으면 Chrome 메뉴의 “앱 설치/페이지를 앱으로 설치” 항목을 사용하세요.'
  }

  if (isMac) {
    return 'Mac에서는 Safari의 “파일 → Dock에 추가” 또는 Chrome/Whale의 웹앱 설치 기능을 사용하세요.'
  }

  return '주소창의 설치 아이콘 또는 브라우저 메뉴의 “앱 설치/이 사이트를 앱으로 설치” 기능을 사용하세요. 설치 기능이 없는 브라우저에서는 Chrome, Edge, Whale을 권장합니다.'
}

export async function requestPwaInstall(): Promise<'installed' | 'dismissed' | 'unavailable' | 'already-installed'> {
  if (isStandaloneApp()) return 'already-installed'
  if (!deferredPrompt) return 'unavailable'

  await deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice

  if (result.outcome === 'accepted') {
    deferredPrompt = null
    return 'installed'
  }

  return 'dismissed'
}
