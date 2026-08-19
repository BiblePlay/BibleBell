import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CSSProperties,
  DragEvent,
  FormEvent,
  ReactNode,
} from 'react'
import {
  ArrowLeft,
  FileAudio,
  FileVideo,
  FolderOpen,
  ImagePlus,
  Play,
  RefreshCw,
  Save,
  HelpCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { categories } from '../data/categories'
import { exportQuestionsToExcel } from '../utils/excelExport'
import { importQuestionsFromExcel } from '../utils/excelImport'
import { uploadProjectAsset } from '../utils/questionStorage'
import {
  exportPortableDataFolder,
  getPortableDataFolderInfo,
  importPortableDataFolder,
  removePortableAsset,
  resolvePortableAssetUrl,
  selectPortableDataLocation,
  supportsPortableFolder,
} from '../utils/portableData'

import type {
  AnswerType,
  CategoryId,
  QuestionType,
  QuizQuestion,
} from '../types'

interface AdminPageProps {
  questions: QuizQuestion[]
  onSave: (questions: QuizQuestion[]) => void
  onBack: () => void
}

interface QuestionForm {
  type: QuestionType
  answerType: AnswerType
  question: string
  answer: string
  hint: string
  choices: string[]
  mediaUrl: string
  questionImageUrl: string
  answerImageUrl: string
  hiddenShowText: boolean
}

interface AssetMeta {
  questionImageName?: string
  answerImageName?: string
  videoName?: string
  audioName?: string
  videoLinked?: boolean
  audioLinked?: boolean
  audioPlayback?: 'auto' | 'manual'
}

type ImageField =
  | 'questionImageUrl'
  | 'answerImageUrl'

type PreviewMode =
  | 'question'
  | 'answer'

type AssetKind =
  | 'questionImage'
  | 'answerImage'
  | 'video'
  | 'audio'

const SLOT_NUMBERS = Array.from(
  { length: 10 },
  (_, index) => index + 1,
)

const FIXED_SCORES = [
  10, 10,
  20, 20,
  30, 30,
  40, 40,
  50, 50,
] as const

const ASSET_META_KEY =
  'biblebell-admin-asset-meta'

const ASSET_DB_NAME =
  'biblebell-admin-assets'

const ASSET_STORE_NAME = 'assets'

const AUTOSAVE_DELAY = 700

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const MAX_IMAGE_EDGE = 1920

const emptyForm: QuestionForm = {
  type: 'general',
  answerType: 'short',
  question: '',
  answer: '',
  hint: '',
  choices: ['', '', '', ''],
  mediaUrl: '',
  questionImageUrl: '',
  answerImageUrl: '',
  hiddenShowText: false,
}

const emptyAssetMeta: AssetMeta = {}

const typeLabels: Record<
  QuestionType,
  string
> = {
  general: '일반 문제',
  ox: 'OX',
  image: '그림퀴즈',
  person: '인물퀴즈',
  video: '영상퀴즈',
  hidden: '숨은그림찾기',
}

const styles: Record<
  string,
  CSSProperties
> = {
  workspace: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1fr) clamp(300px, 32vw, 430px)',
    gap: 22,
    alignItems: 'start',
    minWidth: 0,
  },
  editor: {
    minWidth: 0,
    display: 'grid',
    gap: 18,
  },
  preview: {
    position: 'sticky',
    top: 12,
    width: '100%',
    minWidth: 0,
    maxWidth: 430,
    maxHeight: 'calc(100vh - 96px)',
    padding: 14,
    display: 'grid',
    alignContent: 'start',
    gap: 10,
    overflow: 'auto',
    border:
      '1px solid #d9dee7',
    borderRadius: 12,
    background: '#f4f6f9',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 10,
  },
  previewTabs: {
    display: 'flex',
    gap: 6,
  },
  previewTab: {
    height: 36,
    padding: '0 14px',
    border:
      '1px solid #c9d0dc',
    borderRadius: 7,
    background: '#fff',
    color: '#0e3166',
    fontWeight: 800,
    cursor: 'pointer',
  },
  previewTabActive: {
    color: '#fff',
    borderColor: '#ff730f',
    background: '#ff730f',
  },
  previewScreen: {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    aspectRatio: '16 / 9',
    padding: 14,
    display: 'grid',
    gridTemplateRows:
      'auto minmax(0, 1fr) auto',
    gap: 9,
    overflow: 'hidden',
    color: '#fff',
    borderRadius: 10,
    background:
      'linear-gradient(180deg, #0e1d33, #07111f)',
  },
  previewTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 8,
    color: '#9fb0c7',
    fontSize: 11,
    lineHeight: 1,
    fontWeight: 800,
  },
  previewBody: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  previewMedia: {
    width: '100%',
    minHeight: 0,
    flex: '1 1 auto',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderRadius: 7,
    background: '#050c15',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    display: 'block',
    objectFit: 'contain',
  },
  previewText: {
    width: '100%',
    flex: '0 0 auto',
    maxHeight: '34%',
    overflow: 'hidden',
    color: '#fff',
    fontSize: 20,
    lineHeight: 1.22,
    fontWeight: 900,
    textAlign: 'center',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  },
  previewTextWithImage: {
    maxHeight: '25%',
    padding: '2px 4px 0',
    fontSize: 14,
    lineHeight: 1.24,
  },
  previewHint: {
    width: '100%',
    overflow: 'hidden',
    color: '#ffb14d',
    fontSize: 11,
    lineHeight: 1.25,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  previewChoiceGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap: 5,
  },
  previewChoice: {
    minHeight: 30,
    padding: '5px 7px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    border:
      '1px solid #294565',
    borderRadius: 6,
    background: '#101c2e',
    fontSize: 10,
    lineHeight: 1.15,
    fontWeight: 800,
  },
  previewChoiceNumber: {
    width: 18,
    height: 18,
    flex: '0 0 18px',
    display: 'grid',
    placeItems: 'center',
    color: '#07111f',
    borderRadius: 4,
    background: '#ff9000',
    fontSize: 9,
  },
  previewScore: {
    justifySelf: 'end',
    color: '#ff9000',
    fontSize: 15,
    lineHeight: 1,
    fontWeight: 900,
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  mediaCard: {
    minWidth: 0,
    padding: 12,
    display: 'grid',
    gap: 9,
    border:
      '1px solid #d9dee7',
    borderRadius: 10,
    background: '#fff',
    transition:
      'border-color 120ms ease, box-shadow 120ms ease',
  },
  mediaCardEmphasis: {
    borderColor: '#ff730f',
    boxShadow:
      '0 0 0 3px rgba(255, 115, 15, .12)',
  },
  mediaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 8,
  },
  mediaTitle: {
    color: '#0e3166',
    fontWeight: 900,
  },
  mediaName: {
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    color: '#6b7280',
    fontSize: 12,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dropZone: {
    height: 165,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    border:
      '1px dashed #aeb8c7',
    borderRadius: 8,
    background: '#eaf0f8',
    cursor: 'pointer',
  },
  dropZoneActive: {
    borderColor: '#ff730f',
    background: '#fff2e8',
  },
  unifiedMediaZone: {
    position: 'relative',
  },
  mediaDropWrap: {
    position: 'relative',
    minWidth: 0,
  },
  mediaDeleteOverlay: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    zIndex: 8,
    width: 32,
    minWidth: 32,
    height: 32,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    border:
      '1px solid rgba(255, 255, 255, .72)',
    borderRadius: 7,
    background:
      'rgba(20, 28, 40, .78)',
    boxShadow:
      '0 3px 10px rgba(0, 0, 0, .22)',
    cursor: 'pointer',
  },
  unifiedMediaHint: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none',
  },
  unifiedMediaHintBox: {
    maxWidth: '82%',
    padding: '10px 14px',
    display: 'grid',
    placeItems: 'center',
    gap: 6,
    color: '#0e3166',
    borderRadius: 9,
    background:
      'rgba(255, 255, 255, .9)',
    boxShadow:
      '0 4px 16px rgba(14, 49, 102, .12)',
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 800,
    textAlign: 'center',
  },
  unifiedMediaFooter: {
    width: '100%',
    minWidth: 0,
    display: 'grid',
    gap: 7,
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectPosition: 'center',
  },
  mediaPreviewContain: {
    objectFit: 'contain',
  },
  mediaPreviewCover: {
    objectFit: 'cover',
  },
  mediaPreviewVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#07111f',
  },
  mediaEmpty: {
    padding: 16,
    display: 'grid',
    placeItems: 'center',
    gap: 8,
    color: '#7d8795',
    fontSize: 13,
    textAlign: 'center',
  },
  mediaActions: {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 7,
    overflow: 'hidden',
  },
  selectButton: {
    width: 34,
    minWidth: 34,
    maxWidth: 34,
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    flex: '0 0 34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    background: '#0e3166',
    lineHeight: 1,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  mediaActionButton: {
    width: 34,
    minWidth: 34,
    maxWidth: 34,
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    flex: '0 0 34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0e3166',
    border:
      '1px solid #c9d0dc',
    borderRadius: 7,
    background: '#fff',
    lineHeight: 1,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  disabledButton: {
    color: '#9aa3af',
    borderColor: '#dfe3e8',
    background: '#f3f5f7',
    cursor: 'not-allowed',
    opacity: .68,
  },
  hiddenInput: {
    display: 'none',
  },
  deleteButton: {
    width: 34,
    minWidth: 34,
    maxWidth: 34,
    height: 34,
    minHeight: 34,
    padding: 0,
    boxSizing: 'border-box',
    flex: '0 0 34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#b42318',
    border:
      '1px solid #efc8bf',
    borderRadius: 7,
    background: '#fff',
    lineHeight: 1,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  audioPreview: {
    width: '100%',
  },
  audioOptionGroup: {
    padding: 10,
    display: 'grid',
    gap: 8,
    border:
      '1px solid #d9dee7',
    borderRadius: 8,
    background: '#fff',
  },
  audioOptionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  audioOptionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#0e3166',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },



  autosave: {
    color: '#13795b',
    fontSize: 12,
    fontWeight: 800,
  },
  note: {
    margin: 0,
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 1.45,
  },
}

function getFixedScore(
  number: number,
): number {
  return (
    FIXED_SCORES[number - 1] ?? 10
  )
}

function readFileAsDataUrl(
  file: Blob,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader()

      reader.onload = () =>
        resolve(
          String(
            reader.result ?? '',
          ),
        )

      reader.onerror = () =>
        reject(
          new Error(
            '파일 읽기 실패',
          ),
        )

      reader.readAsDataURL(file)
    },
  )
}

function loadImageElement(
  sourceUrl: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image()

      image.onload = () =>
        resolve(image)

      image.onerror = () =>
        reject(
          new Error(
            '이미지를 불러오지 못했습니다.',
          ),
        )

      image.src = sourceUrl
    },
  )
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob> {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
            return
          }

          reject(
            new Error(
              '이미지 최적화에 실패했습니다.',
            ),
          )
        },
        mimeType,
        mimeType === 'image/png'
          ? undefined
          : 0.9,
      )
    },
  )
}

async function optimizeImage(
  file: File,
): Promise<string> {
  if (
    !SUPPORTED_IMAGE_TYPES.includes(
      file.type as
        (typeof SUPPORTED_IMAGE_TYPES)[number],
    )
  ) {
    throw new Error(
      'JPG, PNG, WEBP 형식만 등록할 수 있습니다.',
    )
  }

  const sourceUrl =
    URL.createObjectURL(file)

  try {
    const image =
      await loadImageElement(
        sourceUrl,
      )

    const longestEdge =
      Math.max(
        image.naturalWidth,
        image.naturalHeight,
      )

    if (
      longestEdge <=
      MAX_IMAGE_EDGE
    ) {
      return readFileAsDataUrl(
        file,
      )
    }

    const scale =
      MAX_IMAGE_EDGE /
      longestEdge

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale,
        ),
      )

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale,
        ),
      )

    const canvas =
      document.createElement(
        'canvas',
      )

    canvas.width = width
    canvas.height = height

    const context =
      canvas.getContext('2d')

    if (!context) {
      throw new Error(
        '이미지 최적화를 지원하지 않는 브라우저입니다.',
      )
    }

    context.imageSmoothingEnabled =
      true

    context.imageSmoothingQuality =
      'high'

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    )

    const optimizedBlob =
      await canvasToBlob(
        canvas,
        file.type,
      )

    return readFileAsDataUrl(
      optimizedBlob,
    )
  } finally {
    URL.revokeObjectURL(
      sourceUrl,
    )
  }
}

function loadMetaMap(): Record<
  string,
  AssetMeta
> {
  try {
    const saved =
      window.localStorage.getItem(
        ASSET_META_KEY,
      )

    if (!saved) return {}

    const parsed = JSON.parse(saved)

    return parsed &&
      typeof parsed === 'object'
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function saveMetaMap(
  metaMap: Record<
    string,
    AssetMeta
  >,
): void {
  window.localStorage.setItem(
    ASSET_META_KEY,
    JSON.stringify(metaMap),
  )
}

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      const request =
        window.indexedDB.open(
          ASSET_DB_NAME,
          1,
        )

      request.onupgradeneeded =
        () => {
          const database =
            request.result

          if (
            !database.objectStoreNames.contains(
              ASSET_STORE_NAME,
            )
          ) {
            database.createObjectStore(
              ASSET_STORE_NAME,
            )
          }
        }

      request.onsuccess = () =>
        resolve(request.result)

      request.onerror = () =>
        reject(request.error)
    },
  )
}

async function putAsset(
  key: string,
  file: Blob,
): Promise<void> {
  const database =
    await openAssetDb()

  await new Promise<void>(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          ASSET_STORE_NAME,
          'readwrite',
        )

      transaction
        .objectStore(
          ASSET_STORE_NAME,
        )
        .put(file, key)

      transaction.oncomplete =
        () => resolve()

      transaction.onerror =
        () =>
          reject(
            transaction.error,
          )
    },
  )

  database.close()
}

async function getAsset(
  key: string,
): Promise<Blob | null> {
  const database =
    await openAssetDb()

  const result =
    await new Promise<
      Blob | null
    >((resolve, reject) => {
      const transaction =
        database.transaction(
          ASSET_STORE_NAME,
          'readonly',
        )

      const request =
        transaction
          .objectStore(
            ASSET_STORE_NAME,
          )
          .get(key)

      request.onsuccess = () =>
        resolve(
          request.result instanceof
            Blob
            ? request.result
            : null,
        )

      request.onerror = () =>
        reject(request.error)
    })

  database.close()
  return result
}

async function deleteAsset(
  key: string,
): Promise<void> {
  const database =
    await openAssetDb()

  await new Promise<void>(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          ASSET_STORE_NAME,
          'readwrite',
        )

      transaction
        .objectStore(
          ASSET_STORE_NAME,
        )
        .delete(key)

      transaction.oncomplete =
        () => resolve()

      transaction.onerror =
        () =>
          reject(
            transaction.error,
          )
    },
  )

  database.close()
}

function getAssetKey(
  questionId: string,
  kind: 'video' | 'audio',
): string {
  return `${questionId}:${kind}`
}

function inferFileName(
  value: string,
  fallback: string,
): string | undefined {
  if (!value) return undefined

  if (value.startsWith('data:')) {
    return fallback
  }

  const clean =
    value.split('?')[0]

  return (
    clean.split('/').pop() ||
    fallback
  )
}


function AdaptiveImagePreview({
  src,
  alt,
  baseStyle,
}: {
  src: string
  alt: string
  baseStyle?: CSSProperties
}) {
  const [
    hasTransparency,
    setHasTransparency,
  ] = useState<boolean | null>(
    null,
  )
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoadError(false)
    let active = true
    let objectUrl = ''
    setResolvedSrc(src)
    void resolvePortableAssetUrl(src).then((value) => {
      if (!active || !value) return
      if (value.startsWith('blob:')) objectUrl = value
      setResolvedSrc(value)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  useEffect(() => {
    let active = true
    const image = new Image()

    image.onload = () => {
      if (!active) return

      const sourceType =
        src.slice(
          5,
          src.indexOf(';'),
        )

      if (
        sourceType ===
        'image/jpeg'
      ) {
        setHasTransparency(false)
        return
      }

      try {
        const canvas =
          document.createElement(
            'canvas',
          )

        const maxSampleEdge = 320
        const longestEdge =
          Math.max(
            image.naturalWidth,
            image.naturalHeight,
          )

        const scale =
          longestEdge >
          maxSampleEdge
            ? maxSampleEdge /
              longestEdge
            : 1

        canvas.width = Math.max(
          1,
          Math.round(
            image.naturalWidth *
              scale,
          ),
        )

        canvas.height = Math.max(
          1,
          Math.round(
            image.naturalHeight *
              scale,
          ),
        )

        const context =
          canvas.getContext(
            '2d',
            {
              willReadFrequently:
                true,
            },
          )

        if (!context) {
          setHasTransparency(
            false,
          )
          return
        }

        context.clearRect(
          0,
          0,
          canvas.width,
          canvas.height,
        )

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height,
        )

        const pixels =
          context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data

        let transparent = false

        for (
          let index = 3;
          index < pixels.length;
          index += 4
        ) {
          if (
            pixels[index] < 255
          ) {
            transparent = true
            break
          }
        }

        setHasTransparency(
          transparent,
        )
      } catch {
        setHasTransparency(
          false,
        )
      }
    }

    image.onerror = () => {
      if (active) {
        setHasTransparency(false)
        setLoadError(true)
      }
    }

    image.src = resolvedSrc

    return () => {
      active = false
    }
  }, [resolvedSrc])

  if (loadError) {
    return (
      <div
        style={{
          ...(baseStyle ?? styles.mediaPreviewImage),
          display: 'grid',
          placeItems: 'center',
          padding: 16,
          boxSizing: 'border-box',
          color: '#7b3f2a',
          background: '#fff7f2',
          border: '1px dashed #e1a78c',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.55,
        }}
      >
        <span>
          이미지를 불러올 수 없습니다.<br />
          이 영역을 클릭해 새 이미지로 바로 교체해 주세요.
        </span>
      </div>
    )
  }

  return (
    <img
      style={{
        ...(baseStyle ??
          styles.mediaPreviewImage),
        ...(hasTransparency ===
        true
          ? styles.mediaPreviewContain
          : styles.mediaPreviewCover),
      }}
      src={resolvedSrc}
      alt={alt}
      onError={() => setLoadError(true)}
    />
  )
}

function DropMediaCard({
  title,
  icon,
  accept,
  fileName,
  preview,
  emptyText,
  emphasized,
  hasFile,
  previewLabel,
  unifiedMediaPicker,
  emptyActionLabel,
  onPreview,
  onSelect,
  onDelete,
}: {
  title: string
  icon: ReactNode
  accept: string
  fileName?: string
  preview: ReactNode
  emptyText: string
  emphasized?: boolean
  hasFile: boolean
  previewLabel?: '미리보기' | '재생'
  unifiedMediaPicker?: boolean
  emptyActionLabel?: string
  onPreview?: () => void
  onSelect: (file?: File) => void
  onDelete: () => void
}) {
  const [
    dragging,
    setDragging,
  ] = useState(false)

  const handleDrop = (
    event:
      DragEvent<HTMLLabelElement>,
  ) => {
    event.preventDefault()
    setDragging(false)

    onSelect(
      event.dataTransfer
        .files?.[0],
    )
  }

  const fileInput = (
    <input
      style={styles.hiddenInput}
      type="file"
      accept={accept}
      onChange={(event) => {
        onSelect(
          event.target
            .files?.[0],
        )

        event.target.value = ''
      }}
    />
  )

  return (
    <section
      style={{
        ...styles.mediaCard,
        ...(emphasized
          ? styles.mediaCardEmphasis
          : {}),
      }}
    >
      <div style={styles.mediaHeader}>
        <span style={styles.mediaTitle}>
          {title}
        </span>

        {icon}
      </div>

      <div style={styles.mediaDropWrap}>
        <label
          style={{
            ...styles.dropZone,
          ...(unifiedMediaPicker
            ? styles.unifiedMediaZone
            : {}),
          ...(dragging
            ? styles.dropZoneActive
            : {}),
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() =>
          setDragging(false)
        }
        onDrop={handleDrop}
      >
        {preview || (
          <span style={styles.mediaEmpty}>
            {unifiedMediaPicker ? (
              <FolderOpen size={28} />
            ) : (
              <UploadCloud size={28} />
            )}

            {unifiedMediaPicker
              ? emptyActionLabel ??
                emptyText
              : emptyText}

            <small>
              드래그하거나 클릭해서 선택
            </small>
          </span>
        )}

        {unifiedMediaPicker &&
          preview &&
          dragging && (
            <span
              style={
                styles.unifiedMediaHint
              }
            >
              <span
                style={
                  styles.unifiedMediaHintBox
                }
              >
                <FolderOpen size={22} />
                새 파일을 놓으면 교체됩니다.
              </span>
            </span>
          )}

          {fileInput}
        </label>

        {hasFile && (
          <button
            type="button"
            style={
              styles.mediaDeleteOverlay
            }
            title="삭제"
            aria-label="삭제"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {!unifiedMediaPicker && (
        <div
          style={styles.mediaName}
          title={fileName}
        >
          {hasFile && fileName
            ? fileName
            : '등록된 파일 없음'}
        </div>
      )}

      {unifiedMediaPicker ? (
        <div
          style={
            styles.unifiedMediaFooter
          }
        >
          <div>
            <div
              style={styles.mediaName}
              title={fileName}
            >
              {hasFile && fileName
                ? fileName
                : '등록된 파일 없음'}
            </div>
            <small style={{ display: 'block', marginTop: 4, color: '#6b7788', fontSize: 11 }}>
              {hasFile
                ? '이미지/미디어 영역을 클릭하거나 교체를 눌러 새 파일로 바로 바꿀 수 있습니다.'
                : '영역을 클릭하거나 파일을 끌어 놓아 등록하세요.'}
            </small>
          </div>

          <div style={styles.mediaActions}>
            {previewLabel && (
              <button
                type="button"
                style={{
                  ...styles.mediaActionButton,
                  ...(!hasFile
                    ? styles.disabledButton
                    : {}),
                }}
                title={previewLabel}
                aria-label={previewLabel}
                disabled={!hasFile}
                onClick={onPreview}
              >
                <Play size={16} />
              </button>
            )}

            <label
              style={{
                ...styles.mediaActionButton,
                gap: 6,
                padding: '0 10px',
                cursor: 'pointer',
              }}
              title={hasFile ? '새 파일로 바로 교체' : '파일 선택'}
              aria-label={hasFile ? '새 파일로 바로 교체' : '파일 선택'}
            >
              <RefreshCw size={16} />
              <span>{hasFile ? '교체' : '선택'}</span>
              {fileInput}
            </label>
          </div>
        </div>
      ) : (
        <div style={styles.mediaActions}>
          <label
            style={styles.selectButton}
            title="파일 선택"
            aria-label="파일 선택"
          >
            <FolderOpen size={17} />
            {fileInput}
          </label>

          {previewLabel && (
            <button
              type="button"
              style={{
                ...styles.mediaActionButton,
                ...(!hasFile
                  ? styles.disabledButton
                  : {}),
              }}
              title={previewLabel}
              aria-label={previewLabel}
              disabled={!hasFile}
              onClick={onPreview}
            >
              <Play size={16} />
            </button>
          )}

          <label
            style={{
              ...styles.mediaActionButton,
              ...(!hasFile
                ? styles.disabledButton
                : {}),
              gap: 6,
              padding: '0 10px',
            }}
            title="새 파일로 바로 교체"
            aria-label="새 파일로 바로 교체"
          >
            <RefreshCw size={16} />
            <span>교체</span>
            {hasFile && fileInput}
          </label>


        </div>
      )}
    </section>
  )
}

export function AdminPage({
  questions,
  onSave,
  onBack,
}: AdminPageProps) {
  const [categoryId, setCategoryId] =
    useState<CategoryId>('joseph')

  const [
    selectedNumber,
    setSelectedNumber,
  ] = useState(1)

  const [form, setForm] =
    useState<QuestionForm>(
      emptyForm,
    )

  const [
    assetMeta,
    setAssetMeta,
  ] = useState<AssetMeta>(
    emptyAssetMeta,
  )

  const [
    videoPreviewUrl,
    setVideoPreviewUrl,
  ] = useState('')

  const [
    audioPreviewUrl,
    setAudioPreviewUrl,
  ] = useState('')

  const [
    previewMode,
    setPreviewMode,
  ] = useState<PreviewMode>(
    'question',
  )


  const [message, setMessage] =
    useState('')
  const [excelLoading, setExcelLoading] =
    useState(false)
  const [portableFolderInfo, setPortableFolderInfo] =
    useState<{ linked: boolean; folderName?: string; permission?: 'granted' | 'prompt' | 'denied' }>({ linked: false })

  const refreshPortableFolderInfo = async () => {
    setPortableFolderInfo(await getPortableDataFolderInfo())
  }

  useEffect(() => {
    void refreshPortableFolderInfo()
  }, [])

  const [
    autosaveState,
    setAutosaveState,
  ] = useState('')

  const loadingRef =
    useRef(true)

  const autosaveTimerRef =
    useRef<number | null>(null)

  const videoElementRef =
    useRef<HTMLVideoElement | null>(null)

  const audioElementRef =
    useRef<HTMLAudioElement | null>(null)

  const selectedQuestion =
    useMemo(
      () =>
        questions.find(
          (item) =>
            item.categoryId ===
              categoryId &&
            item.number ===
              selectedNumber,
        ),
      [
        categoryId,
        questions,
        selectedNumber,
      ],
    )

  const questionId =
    selectedQuestion?.id ??
    `${categoryId}-${selectedNumber}`

  useEffect(() => {
    loadingRef.current = true

    if (!selectedQuestion) {
      setForm(emptyForm)
    } else {
      setForm({
        type:
          selectedQuestion.type ??
          'general',

        answerType:
          selectedQuestion.answerType ??
          'short',

        question:
          selectedQuestion.question,

        answer:
          selectedQuestion.answer,

        hint:
          selectedQuestion.hint ??
          '',

        choices:
          selectedQuestion
            .choices?.length === 4
            ? [
                ...selectedQuestion.choices,
              ]
            : ['', '', '', ''],

        mediaUrl:
          selectedQuestion.mediaUrl ??
          '',

        questionImageUrl:
          selectedQuestion
            .questionImageUrl ??
          ((selectedQuestion.type ===
              'image' ||
            selectedQuestion.type ===
              'person' ||
            selectedQuestion.type ===
              'hidden')
            ? selectedQuestion
                .mediaUrl ?? ''
            : ''),

        answerImageUrl:
          selectedQuestion
            .answerImageUrl ?? '',

        hiddenShowText:
          selectedQuestion.hiddenShowText ?? false,
      })
    }

    const metaMap =
      loadMetaMap()

    setAssetMeta(
      metaMap[questionId] ??
        emptyAssetMeta,
    )


    let videoObjectUrl = ''
    let audioObjectUrl = ''

    const loadStoredAssets =
      async () => {
        try {
          const [
            videoBlob,
            audioBlob,
          ] =
            await Promise.all([
              getAsset(
                getAssetKey(
                  questionId,
                  'video',
                ),
              ),

              getAsset(
                getAssetKey(
                  questionId,
                  'audio',
                ),
              ),
            ])

          const currentMeta =
            loadMetaMap()[questionId] ??
            emptyAssetMeta

          const videoIsLinked =
            currentMeta.videoLinked ??
            Boolean(
              currentMeta.videoName ||
              selectedQuestion?.mediaUrl,
            )

          const audioIsLinked =
            currentMeta.audioLinked ??
            Boolean(
              currentMeta.audioName,
            )

          if (
            videoBlob &&
            videoIsLinked
          ) {
            videoObjectUrl =
              URL.createObjectURL(
                videoBlob,
              )

            setVideoPreviewUrl(
              videoObjectUrl,
            )
          } else if (
            videoIsLinked
          ) {
            const resolvedVideo = await resolvePortableAssetUrl(
              selectedQuestion?.mediaUrl,
            )
            if (resolvedVideo?.startsWith('blob:')) videoObjectUrl = resolvedVideo
            setVideoPreviewUrl(resolvedVideo ?? selectedQuestion?.mediaUrl ?? '')
          } else {
            setVideoPreviewUrl('')
          }

          if (
            audioBlob &&
            audioIsLinked
          ) {
            audioObjectUrl =
              URL.createObjectURL(
                audioBlob,
              )

            setAudioPreviewUrl(
              audioObjectUrl,
            )
          } else {
            setAudioPreviewUrl('')
          }
        } catch {
          const resolvedVideo = await resolvePortableAssetUrl(selectedQuestion?.mediaUrl)
          if (resolvedVideo?.startsWith('blob:')) videoObjectUrl = resolvedVideo
          setVideoPreviewUrl(resolvedVideo ?? selectedQuestion?.mediaUrl ?? '')
          setAudioPreviewUrl('')
        } finally {
          window.setTimeout(() => {
            loadingRef.current = false
          }, 0)
        }
      }

    void loadStoredAssets()

    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(
          videoObjectUrl,
        )
      }

      if (audioObjectUrl) {
        URL.revokeObjectURL(
          audioObjectUrl,
        )
      }
    }
  }, [
    categoryId,
    questionId,
    selectedNumber,
    selectedQuestion,
  ])

  const updateMeta = (
    nextMeta: AssetMeta,
  ) => {
    setAssetMeta(nextMeta)

    const metaMap =
      loadMetaMap()

    metaMap[questionId] =
      nextMeta

    saveMetaMap(metaMap)
  }

  const buildQuestion = (
    targetCategoryId:
      CategoryId = categoryId,
    targetNumber:
      number = selectedNumber,
  ): QuizQuestion => {
    const questionText =
      form.question.trim()

    const answerText =
      form.answer.trim()

    const choices =
      form.choices.map(
        (choice) =>
          choice.trim(),
      )

    return {
      id:
        targetCategoryId ===
          categoryId &&
        targetNumber ===
          selectedNumber
          ? selectedQuestion?.id ??
            `${targetCategoryId}-${targetNumber}`
          : `${targetCategoryId}-${targetNumber}`,

      categoryId:
        targetCategoryId,

      number: targetNumber,

      score: getFixedScore(
        targetNumber,
      ),

      type: form.type,

      answerType:
        form.type === 'ox'
          ? 'multiple'
          : form.answerType,

      question:
        form.type === 'hidden'
          ? questionText
          : questionText,

      answer:
        form.type === 'hidden'
          ? answerText
          : answerText,

      hint:
        form.hint.trim() ||
        undefined,

      choices:
        form.type === 'ox'
          ? ['O', 'X']
          : form.answerType ===
              'multiple'
            ? choices
            : undefined,

      mediaUrl:
        form.type === 'video'
          ? form.mediaUrl.trim() ||
            undefined
          : undefined,

      questionImageUrl:
        form.questionImageUrl ||
        undefined,

      answerImageUrl:
        form.answerImageUrl ||
        undefined,

      hiddenShowText:
        form.type === 'hidden'
          ? form.hiddenShowText
          : undefined,
    }
  }

const importExcelQuestions = async (
  file: File,
) => {
  try {
    setExcelLoading(true)

    const imported =
      await importQuestionsFromExcel(file)

    const next = [
      ...imported,
    ].sort(
      (a, b) =>
        a.categoryId.localeCompare(
          b.categoryId,
        ) ||
        a.number - b.number,
    )

    onSave(next)

    setMessage(
      `${imported.length}개의 문제가 추가되었습니다.`,
    )
  } catch (error) {
    console.error(error)
    setMessage(
      '엑셀 가져오기에 실패했습니다.',
    )
  } finally {
    setExcelLoading(false)
  }
}
  
const saveCurrentQuestion = (
    showMessage = true,
  ) => {
    const savedQuestion =
      buildQuestion()

    const next = [
      ...questions.filter(
        (item) =>
          !(
            item.categoryId ===
              categoryId &&
            item.number ===
              selectedNumber
          ),
      ),
      savedQuestion,
    ].sort(
      (a, b) =>
        a.categoryId.localeCompare(
          b.categoryId,
        ) ||
        a.number - b.number,
    )

    onSave(next)

    if (showMessage) {
      setMessage(
        `${selectedNumber}번 문제가 저장되었습니다.`,
      )
    }
  }

  useEffect(() => {
    if (loadingRef.current) {
      return
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(
        autosaveTimerRef.current,
      )
    }

    setAutosaveState(
      '자동 저장 대기 중',
    )

    autosaveTimerRef.current =
      window.setTimeout(() => {
        saveCurrentQuestion(false)

        setAutosaveState(
          '자동 저장 완료',
        )
      }, AUTOSAVE_DELAY)

    return () => {
      if (
        autosaveTimerRef.current
      ) {
        window.clearTimeout(
          autosaveTimerRef.current,
        )
      }
    }
  }, [form])

  const updateImage = async (
    field: ImageField,
    file?: File,
  ) => {
    if (!file) return
    const previousUrl = form[field]

    try {
      const blob =
        field === 'questionImageUrl'
          ? await optimizeImage(file)
          : await readFileAsDataUrl(file)

      const uploadBlob =
        typeof blob === 'string'
          ? await (await fetch(blob)).blob()
          : blob

      const value = await uploadProjectAsset(
        questionId,
        field === 'questionImageUrl' ? 'questionImage' : 'answerImage',
        uploadBlob,
        file.name,
      )

      setForm((current) => ({
        ...current,
        [field]: value,
      }))

      if (previousUrl && previousUrl !== value) {
        void removePortableAsset(previousUrl)
      }

      updateMeta({
        ...assetMeta,
        [field ===
        'questionImageUrl'
          ? 'questionImageName'
          : 'answerImageName']:
          file.name,
      })

      setMessage(
        field ===
        'questionImageUrl'
          ? '문제 이미지를 최적화하여 불러왔습니다.'
          : '이미지를 불러왔습니다.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '이미지를 읽지 못했습니다.',
      )
    }
  }

  const removeImage = (
    field: ImageField,
  ) => {
    if (form[field]) void removePortableAsset(form[field])
    setForm((current) => ({
      ...current,
      [field]: '',
    }))

    const nextMeta = {
      ...assetMeta,
    }

    if (
      field ===
      'questionImageUrl'
    ) {
      delete nextMeta.questionImageName
    } else {
      delete nextMeta.answerImageName
    }

    updateMeta(nextMeta)
  }

  const updateVideo = async (
    file?: File,
  ) => {
    if (!file) return
    const previousUrl = form.mediaUrl

    try {
      const savedUrl = await uploadProjectAsset(
        questionId,
        'video',
        file,
        file.name,
      )

      const resolvedVideo = await resolvePortableAssetUrl(savedUrl)
      setVideoPreviewUrl(resolvedVideo ?? savedUrl)

      updateMeta({
        ...assetMeta,
        videoName: file.name,
        videoLinked: true,
      })

      setForm((current) => ({
        ...current,
        mediaUrl: savedUrl,
      }))

      if (previousUrl && previousUrl !== savedUrl) {
        void removePortableAsset(previousUrl)
      }

      setMessage(
        '동영상을 불러왔습니다.',
      )
    } catch {
      setMessage(
        '동영상을 읽지 못했습니다.',
      )
    }
  }

  const removeVideo = async () => {
    if (form.mediaUrl) await removePortableAsset(form.mediaUrl)
    setVideoPreviewUrl('')

    setForm((current) => ({
      ...current,
      mediaUrl: '',
    }))

    updateMeta({
      ...assetMeta,
      videoLinked: false,
    })

    setMessage(
      '현재 문제와 동영상의 연결을 해제했습니다.',
    )
  }

  const updateAudio = async (
    file?: File,
  ) => {
    if (!file) return

    try {
      const savedUrl = await uploadProjectAsset(
        questionId,
        'audio',
        file,
        file.name,
      )

      await putAsset(
        getAssetKey(questionId, 'audio'),
        file,
      )

      setAudioPreviewUrl((current) => {
        if (current.startsWith('blob:')) URL.revokeObjectURL(current)
        return URL.createObjectURL(file)
      })

      updateMeta({
        ...assetMeta,
        audioName: file.name,
        audioLinked: true,
        audioPlayback:
          assetMeta.audioPlayback ??
          'manual',
      })

      setMessage(
        '오디오를 등록했습니다.',
      )
    } catch {
      setMessage(
        '오디오를 읽지 못했습니다.',
      )
    }
  }

  const removeAudio = async () => {
    if (audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl)
    setAudioPreviewUrl('')

    try {
      await deleteAsset(getAssetKey(questionId, 'audio'))
      const extension = assetMeta.audioName?.toLowerCase().match(/(\.[a-z0-9]{1,8})$/)?.[1]
      if (extension) {
        await removePortableAsset(`/BibleBell/content/media/audio/${questionId}-audio${extension}`)
      }
    } catch {
      // 화면의 연결 해제는 계속 진행하고, 남은 파일은 다음 교체 시 같은 이름 규칙으로 덮어씁니다.
    }

    const nextMeta = {
      ...assetMeta,
      audioLinked: false,
    }
    delete nextMeta.audioName
    updateMeta(nextMeta)

    setMessage(
      '현재 문제와 오디오를 제거했습니다.',
    )
  }

  const savePortableFolder = async () => {
    try {
      if (!supportsPortableFolder()) {
        setMessage('이 브라우저는 데이터 폴더 기능을 지원하지 않습니다. Chrome, Edge, Whale 데스크톱 브라우저를 사용해 주세요.')
        return
      }
      const currentQuestion = buildQuestion()
      const snapshot = [
        ...questions.filter((item) => !(item.categoryId === categoryId && item.number === selectedNumber)),
        currentQuestion,
      ].sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.number - b.number)
      onSave(snapshot)
      if (!portableFolderInfo.linked) {
        await selectPortableDataLocation(snapshot)
      }
      const result = await exportPortableDataFolder(snapshot)
      await refreshPortableFolderInfo()
      setMessage(`${result.folderName}에 문제 100개와 미디어 ${result.mediaCount}개를 저장했습니다. 이 폴더 전체를 옮기면 다른 컴퓨터에서 복원할 수 있습니다.`)
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
      console.error(error)
      setMessage(error instanceof Error ? error.message : '전체 데이터 저장에 실패했습니다.')
    }
  }

  const loadPortableFolder = async () => {
    try {
      if (!supportsPortableFolder()) {
        setMessage('이 브라우저는 데이터 폴더 기능을 지원하지 않습니다. Chrome, Edge, Whale 데스크톱 브라우저를 사용해 주세요.')
        return
      }
      setExcelLoading(true)
      const imported = await importPortableDataFolder()
      onSave(imported)
      await refreshPortableFolderInfo()
      setMessage(`BibleBell_Data에서 ${imported.length}문제와 미디어 연결을 복원했습니다. 이제 이 컴퓨터에서 그대로 이어서 사용할 수 있습니다.`)
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
      console.error(error)
      setMessage(error instanceof Error ? error.message : '전체 데이터 불러오기에 실패했습니다.')
    } finally {
      setExcelLoading(false)
    }
  }

  const changePortableFolder = async () => {
    try {
      if (!supportsPortableFolder()) {
        setMessage('이 브라우저는 데이터 폴더 기능을 지원하지 않습니다. Chrome, Edge, Whale 데스크톱 브라우저를 사용해 주세요.')
        return
      }
      const currentQuestion = buildQuestion()
      const snapshot = [
        ...questions.filter((item) => !(item.categoryId === categoryId && item.number === selectedNumber)),
        currentQuestion,
      ].sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.number - b.number)
      onSave(snapshot)
      const result = await selectPortableDataLocation(snapshot)
      await refreshPortableFolderInfo()
      setMessage(`${result.folderName} 저장 위치를 연결했습니다. 이후 데이터 보내기로 Excel과 미디어를 함께 최신 상태로 보관할 수 있습니다.`)
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
      console.error(error)
      setMessage(error instanceof Error ? error.message : '저장 위치 지정에 실패했습니다.')
    }
  }

  const submit = (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const questionText =
      form.question.trim()

    const answerText =
      form.answer.trim()

    const choices =
      form.choices.map(
        (choice) =>
          choice.trim(),
      )

    if (
      form.type !== 'hidden' &&
      (!questionText ||
        !answerText)
    ) {
      setMessage(
        '문제와 정답을 입력해 주세요.',
      )
      return
    }

    if (
      form.type === 'hidden' &&
      !form.questionImageUrl
    ) {
      setMessage(
        '숨은그림 원본 이미지를 등록해 주세요.',
      )
      return
    }

    if (
      form.answerType ===
        'multiple' &&
      form.type !== 'ox'
    ) {
      if (
        choices.some(
          (choice) => !choice,
        )
      ) {
        setMessage(
          '보기 4개를 모두 입력해 주세요.',
        )
        return
      }

      if (
        !choices.includes(
          answerText,
        )
      ) {
        setMessage(
          '정답은 보기 중 하나와 같아야 합니다.',
        )
        return
      }
    }

    if (
      form.type === 'video' &&
      !form.mediaUrl.trim()
    ) {
      setMessage(
        '동영상을 선택하거나 영상 주소를 입력해 주세요.',
      )
      return
    }

    saveCurrentQuestion(true)
  }

  const showTextFields =
    form.type !== 'hidden' ||
    form.hiddenShowText

  const showChoices =
    form.answerType ===
      'multiple' &&
    form.type !== 'ox' &&
    form.type !== 'hidden'

  const showAnswerInput =
    form.type !== 'hidden' ||
    form.hiddenShowText

  const showQuestionImage = true
  const showAnswerImage = true
  const showVideo = true
  const showAudio = true

  const previewImage =
    previewMode === 'question'
      ? form.questionImageUrl
      : form.answerImageUrl

  const previewText =
    previewMode === 'question'
      ? form.question
      : form.answer

  const isQuestionImageEmphasized =
    form.type === 'image' ||
    form.type === 'hidden'

  const hasQuestionImage =
    Boolean(form.questionImageUrl)

  const hasAnswerImage =
    Boolean(form.answerImageUrl)

  const hasVideo =
    Boolean(
      videoPreviewUrl &&
      assetMeta.videoLinked !== false,
    )

  const hasAudio =
    Boolean(
      audioPreviewUrl &&
      assetMeta.audioLinked !== false,
    )

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <header className="admin-header">
          <div>
            <span>ADMIN</span>
            <h1>문제 관리</h1>
            <p>
              문제 유형에 맞는 입력 항목만
              표시됩니다.
            </p>
          </div>
<input
  id="excel-upload"
  type="file"
  accept=".xlsx,.xls"
  style={{ display: 'none' }}
  onChange={async (event) => {
    const file = event.target.files?.[0]

    if (file) {
      await importExcelQuestions(file)
      event.target.value = ''
    }
  }}
/>
          <div className="admin-header-actions">
            <button
              className="admin-secondary-button"
              onClick={onBack}
            >
              <ArrowLeft size={18} />
              행사 화면
            </button>
<button
  type="button"
  className="admin-secondary-button"
onClick={() => {
  document
    .getElementById('excel-upload')
    ?.click()
}}
>
  엑셀 가져오기
</button>
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => void loadPortableFolder()}
              disabled={excelLoading}
              title="다른 컴퓨터에서 가져온 BibleBell_Data 폴더를 한 번에 불러옵니다."
            >
              데이터 불러오기
            </button>
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => void savePortableFolder()}
              title="문제·Excel·그림·영상·오디오를 BibleBell_Data 폴더에 함께 저장합니다."
            >
              데이터 보내기
            </button>
          </div>
        </header>

        <section className="admin-portable-guide">
          <div className="admin-portable-guide-main">
            <div>
              <strong>내 BibleBell 데이터 보관 · 이동</strong>
              <p>
                설정에서 저장한 문제는 브라우저에도 보관됩니다. 다른 컴퓨터에서도 같은 문제·그림·동영상을 사용하려면
                <b> 데이터 보내기</b>로 <b>BibleBell_Data</b> 폴더를 최신 상태로 만든 뒤 그 폴더 전체를 옮기세요.
                새 컴퓨터에서는 BibleBell을 열고 <b>데이터 불러오기</b>에서 가져온 BibleBell_Data 폴더를 선택하면 됩니다.
              </p>
            </div>
            <div className="admin-portable-status">
              <span className={portableFolderInfo.linked ? 'is-linked' : 'is-unlinked'}>
                {portableFolderInfo.linked
                  ? `저장 위치 연결됨: ${portableFolderInfo.folderName ?? 'BibleBell_Data'}`
                  : '저장 위치가 아직 지정되지 않았습니다.'}
              </span>
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => void changePortableFolder()}
              >
                {portableFolderInfo.linked ? '저장 위치 변경' : '저장 위치 지정'}
              </button>
            </div>
          </div>

          <details className="admin-help-details">
            <summary><HelpCircle size={17} /> 사용설명서 보기</summary>
            <div className="admin-help-content">
              <section>
                <h3>1. 처음 사용할 때</h3>
                <p>홈 화면의 <b>앱 설치</b>로 BibleBell을 웹앱처럼 설치할 수 있습니다. 처음 편집을 시작할 때는 <b>저장 위치 지정</b>을 눌러 원하는 위치를 선택하세요. 프로그램이 그 위치 안에 BibleBell_Data 폴더를 자동으로 만듭니다.</p>
              </section>
              <section>
                <h3>2. 문제 만들기와 문제 유형 변경</h3>
                <p>카테고리와 번호는 문제의 자리입니다. 그 자리 안에서 일반, OX, 그림, 인물, 영상, 숨은그림 문제와 단답형·객관식 답변 방식을 자유롭게 바꿀 수 있습니다. 객관식은 보기 1~4까지 함께 저장됩니다.</p>
              </section>
              <section>
                <h3>3. 그림·동영상·오디오 교체</h3>
                <p>기존 파일을 먼저 제거할 필요가 없습니다. 미디어 영역을 클릭하거나 <b>교체</b>를 누른 뒤 새 파일을 고르면 같은 문제 자리의 새 미디어로 바뀝니다. BibleBell이 문제 ID 기준의 이름으로 저장하고 Excel에는 다시 찾을 수 있는 경로를 기록합니다.</p>
              </section>
              <section>
                <h3>4. Excel만 관리할 때</h3>
                <p><b>엑셀 다운로드</b>는 현재 100문제의 문제유형, 답변유형, 문제, 정답, 보기, 힌트와 미디어 경로를 표로 내보냅니다. Excel을 정렬해도 카테고리+번호를 기준으로 다시 제자리로 들어옵니다. 미디어까지 다른 컴퓨터로 옮길 때는 Excel만 보내지 말고 데이터 보내기를 사용하세요.</p>
              </section>
              <section>
                <h3>5. 다른 컴퓨터로 옮기기</h3>
                <p><b>BibleBell_Data 폴더 전체</b>를 USB·외장하드·클라우드 등으로 복사합니다. 새 컴퓨터에서 BibleBell 링크를 열고 관리자 모드 → <b>데이터 불러오기</b> → 가져온 BibleBell_Data 폴더를 선택하세요. 프로그램은 자동 저장된 최신 questions.json을 우선 복원하고, Excel은 관리·복구용으로 함께 보관합니다. media 폴더까지 함께 있으면 문제와 미디어가 같은 구성으로 복원됩니다.</p>
              </section>
              <section>
                <h3>6. 컴퓨터를 껐다가 다시 켤 때</h3>
                <p>같은 컴퓨터·같은 브라우저에서는 수정 내용이 브라우저 저장소에 유지됩니다. 폴더 권한을 다시 묻는 경우에는 같은 BibleBell_Data를 다시 허용하면 됩니다. 안전한 이동·백업을 위해 작업을 마친 뒤 <b>데이터 보내기</b>를 눌러 두는 것을 권장합니다.</p>
              </section>
              <section>
                <h3>7. 앱 아이콘 위치</h3>
                <p>PWA 설치가 완료되면 BibleBell은 독립 창으로 실행됩니다. 설치된 아이콘이 바탕화면에 자동으로 생기는지는 운영체제와 브라우저가 결정합니다. 바탕화면에 바로 보이지 않으면 응용 프로그램·앱 목록에서 BibleBell 아이콘을 찾아 Dock/작업표시줄 또는 바탕화면 바로가기로 추가하세요. 데이터 보내기를 하면 BibleBell_Data 안에 Windows용 <b>BibleBell_실행.url</b>과 Mac용 <b>BibleBell_실행.webloc</b>도 만들어져 웹주소 바로가기로 사용할 수 있습니다.</p>
              </section>
            </div>
          </details>
        </section>

        <div className="admin-layout">
          <aside className="admin-nav">
            <label>
              <span>카테고리</span>

              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(
                    event.target
                      .value as CategoryId,
                  )

                  setSelectedNumber(1)
                  setMessage('')
                }}
              >
                {categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.title}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="admin-slot-label">
              문제 번호
            </div>

            <div className="admin-slots">
              {SLOT_NUMBERS.map(
                (number) => {
                  const question =
                    questions.find(
                      (item) =>
                        item.categoryId ===
                          categoryId &&
                        item.number ===
                          number,
                    )

                  return (
                    <button
                      key={number}
                      type="button"
                      className={[
                        selectedNumber ===
                        number
                          ? 'is-selected'
                          : '',
                        question
                          ? 'is-filled'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setSelectedNumber(
                          number,
                        )

                        setMessage('')
                      }}
                    >
                      <strong>
                        {number}
                      </strong>

                      <span>
                        {getFixedScore(
                          number,
                        )}
                        점
                      </span>
                    </button>
                  )
                },
              )}
            </div>
          </aside>

          <form
            className="admin-form"
            onSubmit={submit}
          >
            <div className="admin-form-title">
              {selectedNumber}번 문제 ·{' '}
              {getFixedScore(
                selectedNumber,
              )}
              점
            </div>

            <div style={styles.workspace}>
              <div style={styles.editor}>
                <div className="admin-form-grid">
                  <label>
                    <span>
                      문제 유형
                    </span>

                    <select
                      value={form.type}
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (current) => ({
                            ...current,

                            type:
                              event.target
                                .value as QuestionType,

                            answerType:
                              event.target
                                .value ===
                              'ox'
                                ? 'multiple'
                                : current.answerType,
                          }),
                        )
                      }
                    >
                      {Object.entries(
                        typeLabels,
                      ).map(
                        ([
                          value,
                          label,
                        ]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  {form.type !==
                    'ox' &&
                    form.type !==
                      'hidden' && (
                      <label>
                        <span>
                          답변 방식
                        </span>

                        <select
                          value={
                            form.answerType
                          }
                          onChange={(
                            event,
                          ) =>
                            setForm(
                              (
                                current,
                              ) => ({
                                ...current,

                                answerType:
                                  event
                                    .target
                                    .value as AnswerType,
                              }),
                            )
                          }
                        >
                          <option value="short">
                            단답형
                          </option>

                          <option value="multiple">
                            객관식
                          </option>
                        </select>
                      </label>
                    )}
                </div>

                {form.type === 'hidden' && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      border: '1px solid #d9dee7',
                      borderRadius: 10,
                      background: '#f8fafc',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.hiddenShowText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hiddenShowText: event.target.checked,
                        }))
                      }
                      style={{ width: 18, height: 18 }}
                    />
                    <span>숨은그림 화면에 문제·정답 글자 표시</span>
                  </label>
                )}

                {showTextFields && (
                  <label>
                    <span>문제</span>

                    <textarea
                      rows={form.type === 'hidden' ? 2 : 7}
                      value={
                        form.question
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (current) => ({
                            ...current,

                            question:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>
                )}

                {showChoices && (
                  <div className="admin-choices">
                    <span>보기</span>

                    {form.choices.map(
                      (
                        choice,
                        index,
                      ) => (
                        <label
                          key={index}
                        >
                          <strong>
                            {index + 1}
                          </strong>

                          <input
                            value={
                              choice
                            }
                            onChange={(
                              event,
                            ) =>
                              setForm(
                                (
                                  current,
                                ) => ({
                                  ...current,

                                  choices:
                                    current.choices.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? event
                                              .target
                                              .value
                                          : item,
                                    ),
                                }),
                              )
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                )}

                {showAnswerInput && (
                  <label>
                    <span>정답</span>

                    {form.type ===
                    'ox' ? (
                      <select
                        value={
                          form.answer
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,

                              answer:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                      >
                        <option value="">
                          선택
                        </option>

                        <option value="O">
                          O
                        </option>

                        <option value="X">
                          X
                        </option>
                      </select>
                    ) : (
                      <input
                        value={
                          form.answer
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,

                              answer:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                      />
                    )}
                  </label>
                )}

                <label>
                  <span>
                    힌트 (선택)
                  </span>

                  <input
                    value={form.hint}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,

                          hint:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="필요한 문제에만 입력하세요."
                  />
                </label>

                {(showQuestionImage ||
                  showAnswerImage ||
                  showVideo ||
                  showAudio) && (
                  <div style={styles.mediaGrid}>
                    {showQuestionImage && (
                      <DropMediaCard
                        title={
                          form.type ===
                          'hidden'
                            ? '원본 그림'
                            : '문제 이미지'
                        }
                        icon={
                          <ImagePlus
                            size={18}
                          />
                        }
                        accept="image/jpeg,image/png,image/webp"
                        hasFile={hasQuestionImage}
                        unifiedMediaPicker
                        emptyActionLabel="이미지 넣기"
                        emphasized={
                          isQuestionImageEmphasized
                        }
                        fileName={
                          assetMeta.questionImageName ??
                          inferFileName(
                            form.questionImageUrl,
                            '기존 등록 이미지',
                          )
                        }
                        preview={
                          form.questionImageUrl ? (
                            <AdaptiveImagePreview
                              src={
                                form.questionImageUrl
                              }
                              alt="문제 이미지 미리보기"
                            />
                          ) : null
                        }
                        emptyText="문제 이미지를 등록하세요."
                        onSelect={(file) =>
                          void updateImage(
                            'questionImageUrl',
                            file,
                          )
                        }
                        onDelete={() =>
                          removeImage(
                            'questionImageUrl',
                          )
                        }
                      />
                    )}

                    {showAnswerImage && (
                      <DropMediaCard
                        title={
                          form.type ===
                          'hidden'
                            ? '정답 그림'
                            : '정답 이미지'
                        }
                        icon={
                          <ImagePlus
                            size={18}
                          />
                        }
                        accept="image/jpeg,image/png,image/webp"
                        hasFile={hasAnswerImage}
                        unifiedMediaPicker
                        emptyActionLabel="이미지 넣기" 
                        fileName={
                          assetMeta.answerImageName ??
                          inferFileName(
                            form.answerImageUrl,
                            '기존 등록 이미지',
                          )
                        }
                        preview={
                          form.answerImageUrl ? (
                            <AdaptiveImagePreview
                              src={
                                form.answerImageUrl
                              }
                              alt="정답 이미지 미리보기"
                            />
                          ) : null
                        }
                        emptyText="정답 이미지를 등록하세요."
                        onSelect={(file) =>
                          void updateImage(
                            'answerImageUrl',
                            file,
                          )
                        }
                        onDelete={() =>
                          removeImage(
                            'answerImageUrl',
                          )
                        }
                      />
                    )}

                    {showVideo && (
                      <DropMediaCard
                        title="동영상"
                        icon={
                          <FileVideo
                            size={18}
                          />
                        }
                        accept="video/*"
                        hasFile={hasVideo}
                        unifiedMediaPicker
                        emptyActionLabel="동영상 등록"
                        emphasized
                        previewLabel="미리보기"
                        onPreview={() => {
                          void videoElementRef.current?.play()
                        }}
                        fileName={
                          hasVideo
                            ? assetMeta.videoName ??
                              inferFileName(
                                form.mediaUrl,
                                '기존 등록 영상',
                              )
                            : undefined
                        }
                        preview={
                          videoPreviewUrl ? (
                            <video
                              ref={videoElementRef}
                              style={
                                styles.mediaPreviewVideo
                              }
                              src={
                                videoPreviewUrl
                              }
                              controls
                              muted
                              preload="metadata"
                            />
                          ) : null
                        }
                        emptyText="동영상을 등록하세요."
                        onSelect={(file) =>
                          void updateVideo(
                            file,
                          )
                        }
                        onDelete={() =>
                          void removeVideo()
                        }
                      />
                    )}

                    {showAudio && (
                      <div style={{
                        display: 'grid',
                        gap: 10,
                      }}>
                        <DropMediaCard
                          title="오디오"
                          icon={
                            <FileAudio
                              size={18}
                            />
                          }
                          accept="audio/*"
                          hasFile={hasAudio}
                          unifiedMediaPicker
                          emptyActionLabel="오디오 등록"
                          emphasized
                          previewLabel="재생"
                          onPreview={() => {
                            void audioElementRef.current?.play()
                          }}
                          fileName={
                            hasAudio
                              ? assetMeta.audioName
                              : undefined
                          }
                          preview={
                            audioPreviewUrl ? (
                              <audio
                                ref={audioElementRef}
                                style={
                                  styles.audioPreview
                                }
                                src={
                                  audioPreviewUrl
                                }
                                controls
                                preload="metadata"
                              />
                            ) : null
                          }
                          emptyText="오디오를 등록하세요."
                          onSelect={(file) =>
                            void updateAudio(
                              file,
                            )
                          }
                          onDelete={() =>
                            void removeAudio()
                          }
                        />

                        <div style={styles.audioOptionGroup}>
                          <span>
                            오디오 재생 방식
                          </span>

                          <div style={styles.audioOptionRow}>
                            <label style={{
                              ...styles.audioOptionLabel,
                              ...(!hasAudio
                                ? styles.disabledButton
                                : {}),
                            }}>
                              <input
                                type="radio"
                                name="audio-playback"
                                value="auto"
                                disabled={!hasAudio}
                                checked={
                                  (assetMeta.audioPlayback ??
                                    'manual') === 'auto'
                                }
                                onChange={() =>
                                  updateMeta({
                                    ...assetMeta,
                                    audioPlayback: 'auto',
                                  })
                                }
                              />
                              자동 재생
                            </label>

                            <label style={{
                              ...styles.audioOptionLabel,
                              ...(!hasAudio
                                ? styles.disabledButton
                                : {}),
                            }}>
                              <input
                                type="radio"
                                name="audio-playback"
                                value="manual"
                                disabled={!hasAudio}
                                checked={
                                  (assetMeta.audioPlayback ??
                                    'manual') === 'manual'
                                }
                                onChange={() =>
                                  updateMeta({
                                    ...assetMeta,
                                    audioPlayback: 'manual',
                                  })
                                }
                              />
                              수동 재생
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {form.type ===
                  'video' && (
                  <label>
                    <span>
                      영상 주소
                    </span>

                    <input
                      value={
                        form.mediaUrl
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (current) => ({
                            ...current,

                            mediaUrl:
                              event.target
                                .value,
                          }),
                        )
                      }
                      placeholder="/videos/question.mp4 또는 영상 URL"
                    />
                  </label>
                )}


                <p style={styles.note}>
                  입력 내용은 자동 저장되며,
                  저장 버튼으로 즉시 수동 저장할
                  수도 있습니다.
                </p>
              </div>

              <aside style={styles.preview}>
                <div style={styles.previewHeader}>
                  <strong>
                    실제 화면 미리보기
                  </strong>

                  <div style={styles.previewTabs}>
                    {(
                      [
                        'question',
                        'answer',
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        style={{
                          ...styles.previewTab,
                          ...(previewMode ===
                          mode
                            ? styles.previewTabActive
                            : {}),
                        }}
                        onClick={() =>
                          setPreviewMode(
                            mode,
                          )
                        }
                      >
                        {mode ===
                        'question'
                          ? '문제'
                          : '정답'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.previewScreen}>
                  <div style={styles.previewTop}>
                    <span>
                      {
                        categories.find(
                          (category) =>
                            category.id ===
                            categoryId,
                        )?.title
                      }
                    </span>

                    <span>
                      {selectedNumber}번
                    </span>
                  </div>

                  <div style={styles.previewBody}>
                    {form.type ===
                      'video' &&
                    previewMode ===
                      'question' &&
                    videoPreviewUrl ? (
                      <div style={styles.previewMedia}>
                        <video
                          style={
                            styles.previewVideo
                          }
                          src={
                            videoPreviewUrl
                          }
                          controls
                          muted
                          preload="metadata"
                        />
                      </div>
                    ) : previewImage ? (
                      <div style={styles.previewMedia}>
                        <AdaptiveImagePreview
                          baseStyle={
                            styles.previewImage
                          }
                          src={
                            previewImage
                          }
                          alt="문제 화면 미리보기"
                        />
                      </div>
                    ) : null}

                    {(form.type !== 'hidden' ||
                      form.hiddenShowText) && (
                      <div
                        style={{
                          ...styles.previewText,
                          ...(previewImage
                            ? styles.previewTextWithImage
                            : {}),
                        }}
                      >
                        {previewText ||
                          (previewMode ===
                          'question'
                            ? '문제 내용이 여기에 표시됩니다.'
                            : '정답 내용이 여기에 표시됩니다.')}
                      </div>
                    )}

                    {previewMode ===
                      'question' &&
                      form.answerType ===
                        'multiple' &&
                      form.type !==
                        'ox' && (
                        <div style={styles.previewChoiceGrid}>
                          {form.choices.map(
                            (
                              choice,
                              index,
                            ) => (
                              <div
                                style={
                                  styles.previewChoice
                                }
                                key={index}
                              >
                                <span
                                  style={
                                    styles.previewChoiceNumber
                                  }
                                >
                                  {index + 1}
                                </span>

                                <span>
                                  {choice ||
                                    `보기 ${index + 1}`}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}

                    {previewMode ===
                      'question' &&
                      form.type ===
                        'ox' && (
                        <div style={styles.previewChoiceGrid}>
                          {['O', 'X'].map(
                            (choice) => (
                              <div
                                style={{
                                  ...styles.previewChoice,
                                  justifyContent:
                                    'center',
                                  fontSize: 22,
                                }}
                                key={choice}
                              >
                                {choice}
                              </div>
                            ),
                          )}
                        </div>
                      )}

                    {form.hint &&
                      previewMode ===
                        'question' && (
                        <div style={styles.previewHint}>
                          힌트: {form.hint}
                        </div>
                      )}

                    {audioPreviewUrl && (
                      <audio
                        style={
                          styles.audioPreview
                        }
                        src={
                          audioPreviewUrl
                        }
                        controls
                        preload="metadata"
                      />
                    )}
                  </div>

                  <div style={styles.previewScore}>
                    {getFixedScore(
                      selectedNumber,
                    )}
                    점
                  </div>
                </div>
              </aside>
            </div>
          
            <footer className="admin-form-footer">
              <div>
                <p>{message}</p>
                <span style={styles.autosave}>
                  {autosaveState}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  exportQuestionsToExcel(questions)
                }
              >
                엑셀 다운로드
              </button>

              <button type="submit">
                <Save size={18} />
                저장
              </button>
            </footer>
          </form>
        </div>
      </section>
    </main>
  )
}
