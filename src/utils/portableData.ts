import type { QuizQuestion } from '../types'
import { createQuestionsExcelBlob } from './excelExport'
import { importQuestionsFromExcel } from './excelImport'

const PORTABLE_DB_NAME = 'biblebell-portable-data'
const PORTABLE_DB_VERSION = 1
const FILE_STORE = 'files'
const HANDLE_STORE = 'handles'
const DATA_HANDLE_KEY = 'biblebell-data-folder'
const ASSET_META_KEY = 'biblebell-admin-asset-meta'
const LEGACY_ASSET_DB_NAME = 'biblebell-admin-assets'
const LEGACY_ASSET_STORE = 'assets'
const APP_MEDIA_PREFIX = '/BibleBell/content/media/'

type AnyDirectoryHandle = any

type PortableManifest = {
  format: 'BibleBell_Data'
  version: 1
  exportedAt: string
  questionCount: number
  assetMeta: Record<string, unknown>
}

function openPortableDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PORTABLE_DB_NAME, PORTABLE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE)
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet(storeName: string, key: string): Promise<any> {
  const db = await openPortableDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const request = tx.objectStore(storeName).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openPortableDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function idbEntries(storeName: string): Promise<Array<[string, any]>> {
  const db = await openPortableDb()
  try {
    return await new Promise((resolve, reject) => {
      const entries: Array<[string, any]> = []
      const tx = db.transaction(storeName, 'readonly')
      const request = tx.objectStore(storeName).openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(entries)
          return
        }
        entries.push([String(cursor.key), cursor.value])
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

function normalizeMediaKey(value: string): string {
  if (!value) return value
  if (value.startsWith(APP_MEDIA_PREFIX)) return value
  const marker = '/content/media/'
  const markerIndex = value.indexOf(marker)
  if (markerIndex >= 0) return `/BibleBell${value.slice(markerIndex)}`
  if (value.startsWith('content/media/')) return `/BibleBell/${value}`
  if (value.startsWith('media/')) return `/BibleBell/content/${value}`
  return value
}

function relativeMediaPath(canonicalUrl: string): string | null {
  const normalized = normalizeMediaKey(canonicalUrl)
  if (!normalized.startsWith(APP_MEDIA_PREFIX)) return null
  return `media/${normalized.slice(APP_MEDIA_PREFIX.length)}`
}

async function getSubdirectory(root: AnyDirectoryHandle, parts: string[], create: boolean) {
  let current = root
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create })
  }
  return current
}

async function writeFileAt(root: AnyDirectoryHandle, relativePath: string, blob: Blob) {
  const parts = relativePath.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error('저장할 파일명이 없습니다.')
  const dir = await getSubdirectory(root, parts, true)
  const handle = await dir.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

async function readFileAt(root: AnyDirectoryHandle, relativePath: string): Promise<File | null> {
  try {
    const parts = relativePath.split('/').filter(Boolean)
    const filename = parts.pop()
    if (!filename) return null
    const dir = await getSubdirectory(root, parts, false)
    const handle = await dir.getFileHandle(filename)
    return await handle.getFile()
  } catch {
    return null
  }
}

async function walkDirectory(dir: AnyDirectoryHandle, prefix = ''): Promise<Array<[string, File]>> {
  const files: Array<[string, File]> = []
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      files.push([path, await handle.getFile()])
    } else if (handle.kind === 'directory') {
      files.push(...await walkDirectory(handle, path))
    }
  }
  return files
}

async function requestHandlePermission(handle: AnyDirectoryHandle, mode: 'read' | 'readwrite') {
  if (!handle) return false
  const options = { mode }
  if (await handle.queryPermission?.(options) === 'granted') return true
  return (await handle.requestPermission?.(options)) === 'granted'
}

export function supportsPortableFolder(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

export async function storePortableAsset(canonicalUrl: string, blob: Blob): Promise<void> {
  const key = normalizeMediaKey(canonicalUrl)
  await idbPut(FILE_STORE, key, blob)
}

export async function getPortableAsset(canonicalUrl: string): Promise<Blob | null> {
  const value = await idbGet(FILE_STORE, normalizeMediaKey(canonicalUrl))
  return value instanceof Blob ? value : null
}

export async function resolvePortableAssetUrl(source?: string): Promise<string | undefined> {
  if (!source) return source
  const blob = await getPortableAsset(source)
  return blob ? URL.createObjectURL(blob) : source
}

async function getSavedDataHandle(): Promise<AnyDirectoryHandle | null> {
  try {
    return (await idbGet(HANDLE_STORE, DATA_HANDLE_KEY)) ?? null
  } catch {
    return null
  }
}

async function saveDataHandle(handle: AnyDirectoryHandle): Promise<void> {
  await idbPut(HANDLE_STORE, DATA_HANDLE_KEY, handle)
}

export async function writePortableAssetToLinkedFolder(canonicalUrl: string, blob: Blob): Promise<void> {
  const relative = relativeMediaPath(canonicalUrl)
  if (!relative) return
  const handle = await getSavedDataHandle()
  if (!handle) return
  try {
    if (!(await requestHandlePermission(handle, 'readwrite'))) return
    await writeFileAt(handle, relative, blob)
  } catch {
    // 브라우저 권한이 끊겨도 IndexedDB 저장은 유지합니다.
  }
}

async function putLegacyAudio(questionId: string, blob: Blob): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(LEGACY_ASSET_DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LEGACY_ASSET_STORE)) {
        request.result.createObjectStore(LEGACY_ASSET_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LEGACY_ASSET_STORE, 'readwrite')
      tx.objectStore(LEGACY_ASSET_STORE).put(blob, `${questionId}:audio`)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function loadAssetMeta(): Record<string, unknown> {
  try {
    return JSON.parse(window.localStorage.getItem(ASSET_META_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveAssetMeta(value: Record<string, unknown>) {
  window.localStorage.setItem(ASSET_META_KEY, JSON.stringify(value))
}

function normalizeImportedQuestionPaths(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => ({
    ...q,
    questionImageUrl: q.questionImageUrl ? normalizeMediaKey(q.questionImageUrl) : undefined,
    answerImageUrl: q.answerImageUrl ? normalizeMediaKey(q.answerImageUrl) : undefined,
    mediaUrl: q.mediaUrl ? normalizeMediaKey(q.mediaUrl) : undefined,
  }))
}

async function chooseNewDataFolder(): Promise<AnyDirectoryHandle> {
  if (!supportsPortableFolder()) {
    throw new Error('이 브라우저는 폴더 저장 기능을 지원하지 않습니다. Chrome, Edge, Whale 같은 Chromium 계열 데스크톱 브라우저를 사용해 주세요.')
  }
  const parent = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'biblebell-data-parent' })
  const dataFolder = await parent.getDirectoryHandle('BibleBell_Data', { create: true })
  await saveDataHandle(dataFolder)
  return dataFolder
}

async function getWritableDataFolder(): Promise<AnyDirectoryHandle> {
  const saved = await getSavedDataHandle()
  if (saved && await requestHandlePermission(saved, 'readwrite')) return saved
  return chooseNewDataFolder()
}


export async function requestPersistentBrowserStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

async function getLinkedFolderWithoutPrompt(mode: 'read' | 'readwrite' = 'readwrite'): Promise<AnyDirectoryHandle | null> {
  const handle = await getSavedDataHandle()
  if (!handle) return null
  try {
    return (await handle.queryPermission?.({ mode })) === 'granted' ? handle : null
  } catch {
    return null
  }
}

async function writeQuestionSnapshot(folder: AnyDirectoryHandle, questions: QuizQuestion[]): Promise<void> {
  await writeQuestionSnapshot(folder, questions)
}

/**
 * 사용자가 한 번 BibleBell_Data 폴더를 지정한 뒤에는 문제 수정 내용을
 * 같은 폴더의 questions.xlsx / questions.json에도 자동 반영합니다.
 * 브라우저가 재시작되어 권한이 'prompt'로 돌아간 경우에는 자동으로
 * 권한창을 띄우지 않고 브라우저 저장소만 유지합니다. 사용자가
 * '내 데이터 저장'을 한 번 누르면 같은 폴더 권한을 다시 승인할 수 있습니다.
 */
export async function syncPortableQuestionsIfLinked(questions: QuizQuestion[]): Promise<boolean> {
  const folder = await getLinkedFolderWithoutPrompt('readwrite')
  if (!folder) return false
  try {
    await writeQuestionSnapshot(folder, questions)
    return true
  } catch {
    return false
  }
}

export async function exportPortableDataFolder(questions: QuizQuestion[]): Promise<{ mediaCount: number }> {
  const folder = await getWritableDataFolder()
  await writeQuestionSnapshot(folder, questions)

  const written = new Set<string>()
  const storedAssets = await idbEntries(FILE_STORE)
  for (const [key, value] of storedAssets) {
    if (!(value instanceof Blob)) continue
    const relative = relativeMediaPath(key)
    if (!relative) continue
    await writeFileAt(folder, relative, value)
    written.add(normalizeMediaKey(key))
  }

  const referenced = new Set<string>()
  for (const q of questions) {
    for (const source of [q.questionImageUrl, q.answerImageUrl, q.mediaUrl]) {
      if (source) referenced.add(normalizeMediaKey(source))
    }
  }

  for (const source of referenced) {
    if (written.has(source)) continue
    const relative = relativeMediaPath(source)
    if (!relative) continue
    try {
      const response = await fetch(source)
      if (!response.ok) continue
      const blob = await response.blob()
      await storePortableAsset(source, blob)
      await writeFileAt(folder, relative, blob)
      written.add(source)
    } catch {
      // 존재하지 않는 미디어는 건너뛰고 나머지 백업을 계속합니다.
    }
  }

  return { mediaCount: written.size }
}

export async function importPortableDataFolder(): Promise<QuizQuestion[]> {
  if (!supportsPortableFolder()) {
    throw new Error('이 브라우저는 폴더 불러오기 기능을 지원하지 않습니다. Chrome, Edge, Whale 같은 Chromium 계열 데스크톱 브라우저를 사용해 주세요.')
  }

  const folder = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'biblebell-data-import' })
  await saveDataHandle(folder)

  let questions: QuizQuestion[]
  const excel = await readFileAt(folder, 'questions.xlsx')
  if (excel) {
    questions = await importQuestionsFromExcel(excel)
  } else {
    const jsonFile = await readFileAt(folder, 'questions.json')
    if (!jsonFile) throw new Error('선택한 폴더에서 questions.xlsx 또는 questions.json을 찾지 못했습니다.')
    const parsed = JSON.parse(await jsonFile.text())
    if (!Array.isArray(parsed) || parsed.length !== 100) throw new Error('questions.json은 정확히 100문제여야 합니다.')
    questions = parsed as QuizQuestion[]
  }
  questions = normalizeImportedQuestionPaths(questions)

  const manifestFile = await readFileAt(folder, 'manifest.json')
  if (manifestFile) {
    try {
      const manifest = JSON.parse(await manifestFile.text()) as Partial<PortableManifest>
      if (manifest.assetMeta && typeof manifest.assetMeta === 'object') saveAssetMeta(manifest.assetMeta)
    } catch {
      // 구형 폴더도 문제/미디어 복원은 계속합니다.
    }
  }

  try {
    const mediaDir = await folder.getDirectoryHandle('media')
    const files = await walkDirectory(mediaDir)
    for (const [relative, file] of files) {
      const canonical = normalizeMediaKey(`media/${relative}`)
      await storePortableAsset(canonical, file)
      const match = file.name.match(/^([A-Za-z0-9_-]+)-audio\.[^.]+$/i)
      if (match) await putLegacyAudio(match[1], file)
    }
  } catch {
    // 미디어가 없는 문제집도 정상적으로 복원합니다.
  }

  return questions
}
