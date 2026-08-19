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
