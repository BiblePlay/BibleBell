const SHORTCUT_NAME = 'BibleGoldenBell'

function getAppUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isMacPlatform(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const platform = uaData?.platform || navigator.platform || navigator.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

export type ShortcutResult = {
  fileName: string
  platform: 'mac' | 'windows'
}

export function createDesktopShortcut(): ShortcutResult {
  const appUrl = getAppUrl()

  if (isMacPlatform()) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
      `<plist version="1.0"><dict><key>URL</key><string>${appUrl.replace(/&/g, '&amp;')}</string></dict></plist>\n`
    const fileName = `${SHORTCUT_NAME}.webloc`
    downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName)
    return { fileName, platform: 'mac' }
  }

  const iconUrl = new URL('icons/biblebell.ico', appUrl).href
  const content = `[InternetShortcut]\r\nURL=${appUrl}\r\nIconFile=${iconUrl}\r\nIconIndex=0\r\n`
  const fileName = `${SHORTCUT_NAME}.url`
  downloadBlob(new Blob([content], { type: 'application/internet-shortcut;charset=utf-8' }), fileName)
  return { fileName, platform: 'windows' }
}
