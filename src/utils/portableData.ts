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
const DATA_FOLDER_NAME = 'BibleBell_Data'
const PUBLIC_APP_URL = 'https://bibleplay.github.io/BibleBell/'

type AnyDirectoryHandle = any
let cachedDataHandle: AnyDirectoryHandle | null | undefined

type PortableManifest = {
  format: 'BibleBell_Data'
  version: 2
  exportedAt: string
  questionCount: number
  appUrl: string
  assetMeta: Record<string, unknown>
  mediaCount?: number
  skippedMediaCount?: number
}

export type PortableFolderInfo = {
  linked: boolean
  folderName?: string
  permission?: 'granted' | 'prompt' | 'denied'
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

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openPortableDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).delete(key)
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

function getPublicAppUrl(): string {
  if (window.location.hostname.endsWith('github.io')) {
    return new URL(import.meta.env.BASE_URL, window.location.origin).href
  }
  return PUBLIC_APP_URL
}

async function getSubdirectory(root: AnyDirectoryHandle, parts: string[], create: boolean) {
  let current = root
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create })
  }
  return current
}

function assertPortableFileName(filename: string, relativePath: string) {
  if (!filename || filename === '.' || filename === '..' || /[\/\\]/.test(filename)) {
    throw new Error(`저장할 파일명이 올바르지 않습니다: ${relativePath}`)
  }
}

async function writeFileAt(root: AnyDirectoryHandle, relativePath: string, blob: Blob) {
  const parts = relativePath.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error('저장할 파일명이 없습니다.')
  assertPortableFileName(filename, relativePath)
  const dir = await getSubdirectory(root, parts, true)

  try {
    const handle = await dir.getFileHandle(filename, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`BibleBell_Data 파일 저장 실패: ${relativePath} (${detail})`)
  }
}

function pathStem(value: string): string {
  return value.replace(/\.[^./]+$/, '')
}

async function deleteFileAt(root: AnyDirectoryHandle, relativePath: string) {
  try {
    const parts = relativePath.split('/').filter(Boolean)
    const filename = parts.pop()
    if (!filename) return
    const dir = await getSubdirectory(root, parts, false)
    await dir.removeEntry(filename)
  } catch {
    // 이미 없거나 권한이 없으면 무시합니다.
  }
}

async function removeSiblingVariants(root: AnyDirectoryHandle, relativePath: string) {
  try {
    const parts = relativePath.split('/').filter(Boolean)
    const filename = parts.pop()
    if (!filename) return
    const dir = await getSubdirectory(root, parts, false)
    const stem = pathStem(filename)
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && name !== filename && pathStem(name) === stem) {
        await dir.removeEntry(name)
      }
    }
  } catch {
    // 폴더가 아직 없으면 정리할 것도 없습니다.
  }
}

async function writeTextFile(root: AnyDirectoryHandle, relativePath: string, text: string, type = 'text/plain;charset=utf-8') {
  await writeFileAt(root, relativePath, new Blob([text], { type }))
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
  const stem = pathStem(key)
  const existing = await idbEntries(FILE_STORE)

  // 교체 중 새 파일 저장이 실패해도 기존 파일을 잃지 않도록
  // 새 Blob을 먼저 안전하게 저장한 뒤 같은 문제/용도의 이전 확장자 파일을 정리합니다.
  await idbPut(FILE_STORE, key, blob)

  for (const [existingKey] of existing) {
    if (existingKey !== key && pathStem(existingKey) === stem) {
      await idbDelete(FILE_STORE, existingKey)
    }
  }
}

export async function removePortableAsset(canonicalUrl?: string): Promise<void> {
  if (!canonicalUrl) return
  const key = normalizeMediaKey(canonicalUrl)
  await idbDelete(FILE_STORE, key)
  const relative = relativeMediaPath(key)
  if (!relative) return
  const handle = await getSavedDataHandle()
  if (!handle) return
  try {
    if ((await handle.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return
    await deleteFileAt(handle, relative)
  } catch {
    // 브라우저 저장소 삭제는 이미 완료되었으므로 계속 진행합니다.
  }
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
  if (cachedDataHandle !== undefined) return cachedDataHandle
  try {
    cachedDataHandle = (await idbGet(HANDLE_STORE, DATA_HANDLE_KEY)) ?? null
  } catch {
    cachedDataHandle = null
  }
  return cachedDataHandle
}

async function saveDataHandle(handle: AnyDirectoryHandle): Promise<void> {
  cachedDataHandle = handle
  await idbPut(HANDLE_STORE, DATA_HANDLE_KEY, handle)
}

export async function getPortableDataFolderInfo(): Promise<PortableFolderInfo> {
  const handle = await getSavedDataHandle()
  if (!handle) return { linked: false }

  let permission: PortableFolderInfo['permission'] = 'prompt'
  try {
    permission = await handle.queryPermission?.({ mode: 'readwrite' }) ?? 'prompt'
  } catch {
    permission = 'prompt'
  }

  return {
    linked: true,
    folderName: handle.name ?? DATA_FOLDER_NAME,
    permission,
  }
}

export async function writePortableAssetToLinkedFolder(canonicalUrl: string, blob: Blob): Promise<void> {
  const relative = relativeMediaPath(canonicalUrl)
  if (!relative) return
  const handle = await getSavedDataHandle()
  if (!handle) return

  try {
    // 파일 업로드 중 자동 권한창을 띄우지 않습니다. 권한이 유지된 경우에만 동기화합니다.
    if ((await handle.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return

    // 새 파일을 먼저 기록한 뒤 이전 확장자 변형을 정리합니다.
    // 이렇게 해야 교체 저장이 실패했을 때 기존 백업 파일이 먼저 사라지지 않습니다.
    await writeFileAt(handle, relative, blob)
    await removeSiblingVariants(handle, relative)
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

function portableGuideText(): string {
  const appUrl = getPublicAppUrl()
  return `도전 바이블 골든벨 - BibleBell_Data 사용안내\n\n` +
    `BibleBell 프로그램 틀은 웹/PWA에서 실행되고, 내가 만든 문제와 미디어는 내 컴퓨터에 보관할 수 있습니다.\n` +
    `다른 컴퓨터로 옮길 때는 BibleBell 웹주소와 이 BibleBell_Data 폴더 전체를 함께 가져가세요.\n\n` +
    `■ 처음 사용할 때\n` +
    `1. BibleBell 실행: ${appUrl}\n` +
    `2. 홈 화면의 “바로가기 만들기”를 누르면 BibleGoldenBell 바로가기를 내려받을 수 있습니다.\n` +
    `3. 관리자 모드에서 “저장 위치 지정”을 누르고 원하는 위치를 선택합니다.\n` +
    `4. 프로그램이 선택한 위치 안에 BibleBell_Data 폴더를 자동으로 만들고 관리합니다.\n\n` +
    `■ 평소 작업\n` +
    `- 문제·정답·보기·힌트 등의 수정 내용은 같은 컴퓨터의 같은 브라우저에도 저장됩니다.\n` +
    `- 저장 폴더의 쓰기 권한이 유지되면 questions.json도 자동 동기화됩니다.\n` +
    `- 그림·영상·오디오는 문제 ID 기준의 일정한 파일명으로 정리됩니다.\n` +
    `- 기존 미디어는 먼저 제거하지 않아도 미리보기/안내 영역에서 새 파일을 선택해 바로 교체할 수 있습니다.\n\n` +
    `■ 작업을 마친 뒤\n` +
    `- 관리자 모드의 “전체 데이터 저장”을 누르세요.\n` +
    `- questions.xlsx, questions.json, manifest.json, media 폴더와 이 안내 파일이 최신 상태로 정리됩니다.\n` +
    `- Excel만 따로 옮기면 문제 글자는 복원할 수 있지만 그림·영상·오디오는 함께 복원되지 않습니다.\n\n` +
    `■ 다른 컴퓨터에서 이어서 사용\n` +
    `1. BibleBell_Data 폴더 전체를 USB·외장하드·클라우드 등으로 복사합니다.\n` +
    `2. 새 컴퓨터에서 BibleBell 웹주소를 엽니다.\n` +
    `3. 관리자 모드 → “전체 데이터 불러오기”를 누릅니다.\n` +
    `4. 가져온 BibleBell_Data 폴더 자체 또는 그 바로 위 폴더를 선택합니다.\n` +
    `5. 폴더 권한을 물으면 허용합니다. questions.json과 questions.xlsx 중 더 최근에 수정된 문제 데이터를 먼저 읽고, 미디어까지 같은 구성으로 복원합니다.\n\n` +
    `■ 꼭 기억하세요\n` +
    `- BibleBell_Data 바깥의 부모 폴더 이름과 저장 위치는 자유롭게 정해도 됩니다.\n` +
    `- BibleBell_Data 내부의 파일명과 media 하위 구조는 프로그램이 관리하므로 임의로 바꾸지 않는 것을 권장합니다.\n` +
    `- 브라우저가 폴더 권한을 다시 물으면 같은 BibleBell_Data 폴더를 다시 허용하면 됩니다.\n` +
    `- 전체 데이터 저장 중 일부 미디어를 읽지 못하더라도 기존 media 폴더 전체를 자동 삭제하지 않습니다.\n\n` +
    `웹주소는 APP_URL.txt에서 확인할 수 있습니다.\n` +
    `홈의 “바로가기 만들기”를 누르면 Mac/Windows용 BibleGoldenBell 바로가기를 내려받을 수 있습니다.\n`
}

async function writePortableGuideFiles(folder: AnyDirectoryHandle): Promise<string[]> {
  const appUrl = getPublicAppUrl()
  const warnings: string[] = []

  // 안내 파일은 핵심 데이터가 아닙니다. 파일시스템이 특정 안내 파일명을 거부해도
  // questions.xlsx · questions.json · media · manifest 저장 전체가 실패하지 않게 분리합니다.
  // 브라우저 간 호환성을 높이기 위해 파일명은 안전한 ASCII 이름만 사용합니다.
  const optionalFiles: Array<[string, string]> = [
    ['README_BibleBell.txt', portableGuideText()],
    ['APP_URL.txt', `${appUrl}
`],
  ]

  for (const [name, text] of optionalFiles) {
    try {
      await writeTextFile(folder, name, text)
    } catch (error) {
      console.warn(`BibleBell optional guide write skipped: ${name}`, error)
      warnings.push(name)
    }
  }

  return warnings
}

function createPortableManifest(
  questions: QuizQuestion[],
  mediaCount?: number,
  skippedMediaCount?: number,
): PortableManifest {
  return {
    format: 'BibleBell_Data',
    version: 2,
    exportedAt: new Date().toISOString(),
    questionCount: questions.length,
    appUrl: getPublicAppUrl(),
    assetMeta: loadAssetMeta(),
    ...(mediaCount === undefined ? {} : { mediaCount }),
    ...(skippedMediaCount === undefined ? {} : { skippedMediaCount }),
  }
}

async function writePortableManifest(
  folder: AnyDirectoryHandle,
  questions: QuizQuestion[],
  mediaCount?: number,
  skippedMediaCount?: number,
) {
  const normalizedQuestions = normalizeImportedQuestionPaths(questions)
  const manifest = createPortableManifest(
    normalizedQuestions,
    mediaCount,
    skippedMediaCount,
  )
  await writeTextFile(
    folder,
    'manifest.json',
    JSON.stringify(manifest, null, 2),
    'application/json;charset=utf-8',
  )
}

async function writeQuestionFiles(
  folder: AnyDirectoryHandle,
  questions: QuizQuestion[],
): Promise<{ questions: QuizQuestion[]; optionalGuideFailures: string[] }> {
  const normalizedQuestions = normalizeImportedQuestionPaths(questions)

  // 복구의 기준인 JSON을 먼저, 사람이 관리하는 Excel을 다음에 저장합니다.
  // 핵심 파일 저장에 실패하더라도 이미 성공한 파일이나 기존 media를 자동 삭제하지 않습니다.
  await writeTextFile(
    folder,
    'questions.json',
    JSON.stringify(normalizedQuestions, null, 2),
    'application/json;charset=utf-8',
  )
  await writeFileAt(folder, 'questions.xlsx', createQuestionsExcelBlob(normalizedQuestions))

  const optionalGuideFailures = await writePortableGuideFiles(folder)
  return { questions: normalizedQuestions, optionalGuideFailures }
}

async function writeQuestionSnapshot(folder: AnyDirectoryHandle, questions: QuizQuestion[]): Promise<void> {
  const result = await writeQuestionFiles(folder, questions)
  // snapshot 단독 저장에서는 핵심 파일이 모두 성공한 뒤 manifest를 마지막에 기록합니다.
  await writePortableManifest(folder, result.questions)
}

async function writeQuestionAutosave(folder: AnyDirectoryHandle, questions: QuizQuestion[]): Promise<void> {
  const normalizedQuestions = normalizeImportedQuestionPaths(questions)
  // 평소 자동 저장은 최신 문제 본문만 questions.json에 반영합니다.
  // manifest.json은 전체 데이터 저장/초기 연결/복원처럼 패키지 단위 작업이 완료될 때 갱신하여
  // 명시적 내보내기와 자동 저장이 서로 덮어쓰는 경쟁을 피합니다.
  await writeTextFile(folder, 'questions.json', JSON.stringify(normalizedQuestions, null, 2), 'application/json;charset=utf-8')
}


async function chooseNewDataFolder(): Promise<AnyDirectoryHandle> {
  if (!supportsPortableFolder()) {
    throw new Error('이 브라우저는 폴더 저장 기능을 지원하지 않습니다. Chrome, Edge, Whale 같은 Chromium 계열 데스크톱 브라우저를 사용해 주세요.')
  }

  const parent = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
    id: 'biblebell-data-parent',
  })

  // 사용자가 이미 BibleBell_Data 자체를 선택한 경우에는 같은 폴더를 그대로 씁니다.
  // 그 외에는 사용자가 고른 자유로운 위치 안에 BibleBell_Data를 자동 생성합니다.
  const dataFolder = parent.name === DATA_FOLDER_NAME
    ? parent
    : await parent.getDirectoryHandle(DATA_FOLDER_NAME, { create: true })
  await saveDataHandle(dataFolder)
  return dataFolder
}

export async function preparePortableExportLocation(): Promise<AnyDirectoryHandle> {
  const saved = await getSavedDataHandle()

  if (saved) {
    try {
      const current = await saved.queryPermission?.({ mode: 'readwrite' })
      if (current === 'granted') return saved

      // 이전에 선택한 폴더 핸들은 IndexedDB에 기억합니다.
      // 권한이 prompt로 돌아온 경우 새 폴더 선택창을 열지 않고,
      // 사용자가 이미 연결한 같은 BibleBell_Data에 대한 권한만 다시 요청합니다.
      if (current === 'prompt') {
        const granted = await requestHandlePermission(saved, 'readwrite')
        if (granted) return saved
        throw new Error('이전에 연결한 BibleBell_Data 폴더의 쓰기 권한이 허용되지 않았습니다. “저장 위치 변경”에서 같은 폴더를 다시 연결하거나 새 위치를 지정해 주세요.')
      }

      if (current === 'denied') {
        throw new Error('이전에 연결한 BibleBell_Data 폴더 접근이 차단되어 있습니다. “저장 위치 변경”에서 같은 폴더를 다시 연결하거나 새 위치를 지정해 주세요.')
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('BibleBell_Data')) throw error
      throw new Error('이전에 연결한 BibleBell_Data 폴더를 사용할 수 없습니다. “저장 위치 변경”에서 같은 폴더를 다시 연결하거나 새 위치를 지정해 주세요.')
    }
  }

  // 저장 위치를 아직 한 번도 정하지 않은 경우에만 최초 폴더 선택창을 엽니다.
  return chooseNewDataFolder()
}

export async function connectPortableDataLocation(): Promise<{ folderName: string }> {
  const folder = await chooseNewDataFolder()
  return { folderName: folder.name ?? DATA_FOLDER_NAME }
}

export async function selectPortableDataLocation(questions: QuizQuestion[]): Promise<{ folderName: string }> {
  const folder = await chooseNewDataFolder()
  await writeQuestionSnapshot(folder, questions)
  return { folderName: folder.name ?? DATA_FOLDER_NAME }
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

/**
 * 연결된 BibleBell_Data 폴더에 쓰기 권한이 유지된 동안에는
 * 문제 수정 내용을 questions.json에 자동 동기화합니다. Excel과 manifest는 “전체 데이터 저장” 때 최신 상태로 만듭니다.
 * 권한이 끊긴 경우 자동 권한창을 띄우지 않고 브라우저 저장소만 유지합니다.
 */
export async function syncPortableQuestionsIfLinked(questions: QuizQuestion[]): Promise<boolean> {
  const folder = await getLinkedFolderWithoutPrompt('readwrite')
  if (!folder) return false
  try {
    await writeQuestionAutosave(folder, questions)
    return true
  } catch {
    return false
  }
}

export async function exportPortableDataFolder(
  questions: QuizQuestion[],
  preparedFolder?: AnyDirectoryHandle,
): Promise<{
  mediaCount: number
  skippedMediaCount: number
  folderName: string
  optionalGuideFailures: string[]
}> {
  const folder = preparedFolder ?? await preparePortableExportLocation()
  const questionFiles = await writeQuestionFiles(folder, questions)
  const normalizedQuestions = questionFiles.questions

  const referenced = new Set<string>()
  for (const q of normalizedQuestions) {
    for (const source of [q.questionImageUrl, q.answerImageUrl, q.mediaUrl]) {
      if (source) referenced.add(normalizeMediaKey(source))
    }
  }

  const metaMap = loadAssetMeta() as Record<string, { audioName?: string; audioLinked?: boolean }>
  const audioLinkedIds = new Set(
    Object.entries(metaMap)
      .filter(([, meta]) => meta?.audioLinked !== false && (meta?.audioLinked === true || Boolean(meta?.audioName)))
      .map(([questionId]) => questionId),
  )

  // 데이터 안전을 우선합니다. 기존 media 폴더를 통째로 지우지 않습니다.
  // 현재 연결된 파일은 같은 상대경로에 덮어쓰고, 사용자가 명시적으로 제거/교체한
  // 개별 파일만 그 시점에 정리합니다. 일부 미디어 저장이 실패해도 나머지 데이터는 계속 보관합니다.
  const written = new Set<string>()
  const skipped = new Set<string>()

  const storedAssets = await idbEntries(FILE_STORE)
  for (const [key, value] of storedAssets) {
    if (!(value instanceof Blob)) continue
    const normalizedKey = normalizeMediaKey(key)
    const relative = relativeMediaPath(normalizedKey)
    if (!relative) continue

    const audioMatch = relative.match(/^media\/audio\/(.+)-audio\.[^.]+$/i)
    const shouldWrite = audioMatch
      ? audioLinkedIds.has(audioMatch[1])
      : referenced.has(normalizedKey)
    if (!shouldWrite) continue

    try {
      await writeFileAt(folder, relative, value)
      written.add(normalizedKey)
    } catch (error) {
      console.error(error)
      skipped.add(normalizedKey)
    }
  }

  for (const source of referenced) {
    if (written.has(source)) continue
    const relative = relativeMediaPath(source)
    if (!relative) continue
    try {
      const response = await fetch(source)
      if (!response.ok) {
        skipped.add(source)
        continue
      }
      const blob = await response.blob()
      await storePortableAsset(source, blob)
      await writeFileAt(folder, relative, blob)
      written.add(source)
      skipped.delete(source)
    } catch (error) {
      console.error(error)
      skipped.add(source)
    }
  }

  // media 저장까지 모두 시도한 뒤 manifest를 마지막에 갱신합니다.
  // 따라서 manifest의 완료 시각은 이번 내보내기 작업이 실제로 끝난 시점을 의미합니다.
  await writePortableManifest(folder, normalizedQuestions, written.size, skipped.size)

  return {
    mediaCount: written.size,
    skippedMediaCount: skipped.size,
    folderName: folder.name ?? DATA_FOLDER_NAME,
    optionalGuideFailures: questionFiles.optionalGuideFailures,
  }
}

async function folderLooksLikeBibleBellData(folder: AnyDirectoryHandle): Promise<boolean> {
  return Boolean(
    (await readFileAt(folder, 'questions.xlsx')) ||
    (await readFileAt(folder, 'questions.json')),
  )
}

async function resolveImportFolder(selected: AnyDirectoryHandle): Promise<AnyDirectoryHandle> {
  if (await folderLooksLikeBibleBellData(selected)) return selected

  try {
    const nested = await selected.getDirectoryHandle(DATA_FOLDER_NAME)
    if (await folderLooksLikeBibleBellData(nested)) return nested
  } catch {
    // 아래의 명확한 안내 오류로 처리합니다.
  }

  throw new Error('선택한 위치에서 BibleBell_Data의 questions.xlsx 또는 questions.json을 찾지 못했습니다. BibleBell_Data 폴더 자체 또는 그 바로 위 폴더를 선택해 주세요.')
}

function isValidPortableQuestionSet(value: unknown): value is QuizQuestion[] {
  if (!Array.isArray(value) || value.length !== 100) return false
  const allowedCategories = new Set([
    'hidden', 'memory', 'ox', 'sermon', 'surprise',
    'joseph', 'character', 'initial', 'bible', 'teacher',
  ])
  const seen = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== 'object') return false
    const question = item as Partial<QuizQuestion>
    if (!question.categoryId || !allowedCategories.has(question.categoryId)) return false
    if (!Number.isInteger(question.number) || (question.number ?? 0) < 1 || (question.number ?? 0) > 10) return false
    const key = `${question.categoryId}:${question.number}`
    if (seen.has(key)) return false
    seen.add(key)
  }

  return seen.size === 100
}

export async function importPortableDataFolder(): Promise<QuizQuestion[]> {
  if (!supportsPortableFolder()) {
    throw new Error('이 브라우저는 폴더 불러오기 기능을 지원하지 않습니다. Chrome, Edge, Whale 같은 Chromium 계열 데스크톱 브라우저를 사용해 주세요.')
  }

  const selected = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
    id: 'biblebell-data-import',
  })
  const folder = await resolveImportFolder(selected)
  await saveDataHandle(folder)

  let questions: QuizQuestion[] | null = null

  const jsonFile = await readFileAt(folder, 'questions.json')
  const excelFile = await readFileAt(folder, 'questions.xlsx')

  // 평소 앱 편집은 questions.json이 자동 동기화되지만,
  // 사용자가 내보낸 Excel을 나중에 직접 수정했다면 Excel의 수정 시간이 더 최신일 수 있습니다.
  // 두 파일이 모두 있으면 실제로 더 최근에 수정된 파일을 먼저 읽고,
  // 그 파일이 손상되었을 때만 다른 파일로 안전하게 복구합니다.
  const preferExcel = Boolean(
    excelFile && (!jsonFile || excelFile.lastModified > jsonFile.lastModified + 1000),
  )

  const tryJson = async () => {
    if (!jsonFile || questions) return
    try {
      const parsed = JSON.parse(await jsonFile.text())
      if (isValidPortableQuestionSet(parsed)) questions = parsed
    } catch {
      // 다른 복구 경로를 시도합니다.
    }
  }

  const tryExcel = async () => {
    if (!excelFile || questions) return
    try {
      const imported = await importQuestionsFromExcel(excelFile)
      if (isValidPortableQuestionSet(imported)) questions = imported
    } catch {
      // 다른 복구 경로를 시도합니다.
    }
  }

  if (preferExcel) {
    await tryExcel()
    await tryJson()
  } else {
    await tryJson()
    await tryExcel()
  }

  if (!questions) {
    throw new Error('선택한 폴더에서 정상적인 questions.json 또는 questions.xlsx를 찾지 못했습니다.')
  }

  questions = normalizeImportedQuestionPaths(questions)

  let importedAssetMeta: Record<string, any> = {}
  const manifestFile = await readFileAt(folder, 'manifest.json')
  if (manifestFile) {
    try {
      const manifest = JSON.parse(await manifestFile.text()) as Partial<PortableManifest>
      if (manifest.assetMeta && typeof manifest.assetMeta === 'object') {
        importedAssetMeta = manifest.assetMeta as Record<string, any>
        saveAssetMeta(importedAssetMeta)
      }
    } catch {
      // 구형 폴더도 문제/미디어 복원은 계속합니다.
    }
  }

  try {
    const mediaDir = await folder.getDirectoryHandle('media')
    const files = await walkDirectory(mediaDir)

    const referencedMedia = new Set<string>()
    for (const question of questions) {
      for (const source of [question.questionImageUrl, question.answerImageUrl, question.mediaUrl]) {
        if (source) referencedMedia.add(normalizeMediaKey(source))
      }
    }

    const audioCandidates = new Map<string, Array<[string, File]>>()

    for (const [relative, file] of files) {
      const audioMatch = file.name.match(/^([A-Za-z0-9_-]+)-audio\.[^.]+$/i)
      if (audioMatch) {
        const list = audioCandidates.get(audioMatch[1]) ?? []
        list.push([relative, file])
        audioCandidates.set(audioMatch[1], list)
        continue
      }

      const canonical = normalizeMediaKey(`media/${relative}`)
      // 예전 버전에서 남은 확장자 변형/고아 파일은 현재 문제 데이터가 실제로 가리킬 때만 복원합니다.
      // 그래야 오래된 Qxxx-question.jpg가 최신 Qxxx-question.png를 덮어쓰지 않습니다.
      if (!referencedMedia.has(canonical)) continue
      await storePortableAsset(canonical, file)
    }

    for (const [questionId, candidates] of audioCandidates) {
      const meta = importedAssetMeta[questionId] as { audioName?: string; audioLinked?: boolean } | undefined
      if (meta?.audioLinked === false) continue

      const expectedExt = meta?.audioName?.toLowerCase().match(/(\.[a-z0-9]{1,8})$/)?.[1]
      const preferred = expectedExt
        ? candidates.find(([, file]) => file.name.toLowerCase().endsWith(expectedExt))
        : undefined
      const selectedAudio = preferred ?? [...candidates].sort((a, b) => b[1].lastModified - a[1].lastModified)[0]
      if (!selectedAudio) continue

      const [relative, file] = selectedAudio
      const canonical = normalizeMediaKey(`media/${relative}`)
      await storePortableAsset(canonical, file)
      await putLegacyAudio(questionId, file)
    }
  } catch {
    // 미디어가 없는 문제집도 정상적으로 복원합니다.
  }

  // 불러온 즉시 현재 구조로 snapshot을 다시 써서 안내/manifest도 최신화합니다.
  try {
    if (await requestHandlePermission(folder, 'readwrite')) {
      await writeQuestionSnapshot(folder, questions)
    }
  } catch {
    // 읽기 복원은 이미 끝났으므로 쓰기 실패가 전체 복원을 막지 않습니다.
  }

  return questions
}
