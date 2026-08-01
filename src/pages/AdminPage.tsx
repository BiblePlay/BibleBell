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
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { categories } from '../data/categories'
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
        setHasTransparency(
          false,
        )
      }
    }

    image.src = src

    return () => {
      active = false
    }
  }, [src])

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
      src={src}
      alt={alt}
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
          <div
            style={styles.mediaName}
            title={fileName}
          >
            {hasFile && fileName
              ? fileName
              : '등록된 파일 없음'}
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
            }}
            title="변경"
            aria-label="변경"
          >
            <RefreshCw size={16} />
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
            setVideoPreviewUrl(
              selectedQuestion
                ?.mediaUrl ?? '',
            )
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
          setVideoPreviewUrl(
            selectedQuestion
              ?.mediaUrl ?? '',
          )

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
          ? questionText ||
            '숨은그림을 찾아보세요.'
          : questionText,

      answer:
        form.type === 'hidden'
          ? answerText ||
            '정답 그림을 확인하세요.'
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

    try {
      const value =
        field ===
        'questionImageUrl'
          ? await optimizeImage(
              file,
            )
          : await readFileAsDataUrl(
              file,
            )

      setForm((current) => ({
        ...current,
        [field]: value,
      }))

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

    try {
      await putAsset(
        getAssetKey(
          questionId,
          'video',
        ),
        file,
      )

      setVideoPreviewUrl(
        URL.createObjectURL(file),
      )

      updateMeta({
        ...assetMeta,
        videoName: file.name,
        videoLinked: true,
      })

      const dataUrl =
        await readFileAsDataUrl(
          file,
        )

      setForm((current) => ({
        ...current,
        mediaUrl: dataUrl,
      }))

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
      await putAsset(
        getAssetKey(
          questionId,
          'audio',
        ),
        file,
      )

      setAudioPreviewUrl(
        URL.createObjectURL(file),
      )

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
    setAudioPreviewUrl('')

    updateMeta({
      ...assetMeta,
      audioLinked: false,
    })

    setMessage(
      '현재 문제와 오디오의 연결을 해제했습니다.',
    )
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
    form.type !== 'hidden'

  const showChoices =
    form.answerType ===
      'multiple' &&
    form.type !== 'ox' &&
    form.type !== 'hidden'

  const showAnswerInput =
    form.type !== 'hidden'

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

          <div className="admin-header-actions">
            <button
              className="admin-secondary-button"
              onClick={onBack}
            >
              <ArrowLeft size={18} />
              행사 화면
            </button>
          </div>
        </header>

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

                {showTextFields && (
                  <label>
                    <span>문제</span>

                    <textarea
                      rows={7}
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
