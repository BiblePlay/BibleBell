import { ArrowLeft, Eye, EyeOff, Volume2 } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import type { QuizQuestion } from '../types'

interface QuestionPageProps {
  question: QuizQuestion
  showAnswer: boolean
  onToggleAnswer: () => void
  onBack: () => void
  onHome: () => void
}


interface AudioMeta {
  audioLinked?: boolean
  audioPlayback?: 'auto' | 'manual'
}

const AUDIO_META_KEY =
  'biblebell-admin-asset-meta'

const AUDIO_DB_NAME =
  'biblebell-admin-assets'

const AUDIO_STORE_NAME = 'assets'

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      const request =
        window.indexedDB.open(
          AUDIO_DB_NAME,
          1,
        )

      request.onupgradeneeded =
        () => {
          const database =
            request.result

          if (
            !database.objectStoreNames.contains(
              AUDIO_STORE_NAME,
            )
          ) {
            database.createObjectStore(
              AUDIO_STORE_NAME,
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

async function getQuestionAudio(
  questionId: string,
): Promise<Blob | null> {
  const database =
    await openAudioDb()

  const result =
    await new Promise<
      Blob | null
    >((resolve, reject) => {
      const transaction =
        database.transaction(
          AUDIO_STORE_NAME,
          'readonly',
        )

      const request =
        transaction
          .objectStore(
            AUDIO_STORE_NAME,
          )
          .get(
            `${questionId}:audio`,
          )

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

function getQuestionAudioMeta(
  questionId: string,
): AudioMeta {
  try {
    const saved =
      window.localStorage.getItem(
        AUDIO_META_KEY,
      )

    if (!saved) return {}

    const parsed = JSON.parse(saved)

    return (
      parsed?.[questionId] ?? {}
    )
  } catch {
    return {}
  }
}

function QuestionAudioControl({
  questionId,
  showAnswer,
}: {
  questionId: string
  showAnswer: boolean
}) {
  const [audioUrl, setAudioUrl] =
    useState('')

  const [
    playbackMode,
    setPlaybackMode,
  ] = useState<
    'auto' | 'manual'
  >('manual')

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null,
    )

  useEffect(() => {
    let objectUrl = ''
    let active = true

    const loadAudio = async () => {
      const meta =
        getQuestionAudioMeta(
          questionId,
        )

      if (
        meta.audioLinked === false
      ) {
        if (active) {
          setAudioUrl('')
        }
        return
      }

      setPlaybackMode(
        meta.audioPlayback ??
        'manual',
      )

      try {
        const audioBlob =
          await getQuestionAudio(
            questionId,
          )

        if (
          !active ||
          !audioBlob
        ) {
          if (active) {
            setAudioUrl('')
          }
          return
        }

        objectUrl =
          URL.createObjectURL(
            audioBlob,
          )

        setAudioUrl(objectUrl)
      } catch {
        if (active) {
          setAudioUrl('')
        }
      }
    }

    void loadAudio()

    return () => {
      active = false

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        )
      }
    }
  }, [questionId])

  useEffect(() => {
    if (
      showAnswer ||
      !audioUrl ||
      playbackMode !== 'auto'
    ) {
      return
    }

    const audio =
      audioRef.current

    if (!audio) return

    audio.currentTime = 0

    void audio.play().catch(
      () => {
        // 브라우저 자동 재생 정책에 의해 차단될 수 있습니다.
      },
    )
  }, [
    audioUrl,
    playbackMode,
    showAnswer,
  ])

  if (!audioUrl) return null

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        style={{ display: 'none' }}
      />

      {!showAnswer &&
        playbackMode === 'manual' && (
          <button
            type="button"
            title="문제 듣기"
            aria-label="문제 듣기"
            onClick={() => {
              const audio =
                audioRef.current

              if (!audio) return

              audio.currentTime = 0
              void audio.play()
            }}
            style={{
              position: 'absolute',
              left: 18,
              bottom: 18,
              zIndex: 20,
              minWidth: 126,
              height: 42,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: '#07111d',
              border: 0,
              borderRadius: 8,
              background: 'var(--accent)',
              fontSize: 15,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            <Volume2 size={18} />
            문제 듣기
          </button>
        )}
    </>
  )
}

function getTextSize(length: number): string {
  if (length <= 28) return 'size-xl'
  if (length <= 55) return 'size-lg'
  if (length <= 90) return 'size-md'
  return 'size-sm'
}

function getChoiceSize(length: number): string {
  if (length <= 18) return 'choice-lg'
  if (length <= 34) return 'choice-md'
  return 'choice-sm'
}

const oxStyles: Record<string, CSSProperties> = {
  page: {
    height: '100%',
    minHeight: 0,
    padding: '16px',
    display: 'grid',
    gridTemplateRows: '42px minmax(0, 1fr) 54px',
    gap: '10px',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarButton: {
    padding: '8px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    background: 'var(--panel-soft)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  toolbarTitle: {
    color: 'var(--accent)',
    fontSize: '15px',
    fontWeight: 900,
    letterSpacing: '0.12em',
  },
  questionStage: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) minmax(250px, 46%)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  questionLabel: {
    justifySelf: 'center',
    padding: '7px 18px',
    color: 'var(--accent)',
    fontSize: '18px',
    fontWeight: 900,
    letterSpacing: '0.12em',
  },
  questionText: {
    width: 'min(1080px, 94%)',
    maxHeight: '100%',
    margin: '0 auto',
    padding: '18px 28px',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    color: 'var(--text)',
    borderTop: '1px solid var(--line)',
    borderBottom: '1px solid var(--line)',
    textAlign: 'center',
    fontSize: 'clamp(38px, 4vw, 72px)',
    lineHeight: 1.22,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  },
  choices: {
    width: 'min(940px, 88%)',
    height: '100%',
    margin: '0 auto',
    paddingTop: '20px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '52px',
    alignItems: 'stretch',
  },
  choice: {
    minHeight: 0,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--accent)',
    border: '2px solid var(--accent)',
    borderRadius: '24px',
    background: 'var(--card)',
    fontSize: 'clamp(170px, 24vh, 290px)',
    lineHeight: 0.8,
    fontWeight: 900,
  },
  answerStage: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) auto auto',
    placeItems: 'center',
    overflow: 'hidden',
    textAlign: 'center',
  },
  answerSymbol: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--accent)',
    fontSize: 'clamp(300px, 62vh, 620px)',
    lineHeight: 0.78,
    fontWeight: 900,
  },
  answerText: {
    color: 'var(--text)',
    fontSize: 'clamp(38px, 3.5vw, 62px)',
    lineHeight: 1,
    fontWeight: 900,
  },
  answerScore: {
    marginTop: '14px',
    color: 'var(--accent)',
    fontSize: 'clamp(24px, 2vw, 34px)',
    lineHeight: 1,
    fontWeight: 900,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButton: {
    minWidth: '210px',
    height: '50px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#07111d',
    border: 0,
    borderRadius: '9px',
    background: 'var(--accent)',
    fontSize: '17px',
    fontWeight: 900,
    cursor: 'pointer',
  },
}

function OxQuestionView({
  question,
  showAnswer,
  onToggleAnswer,
  onBack,
}: Pick<
  QuestionPageProps,
  'question' | 'showAnswer' | 'onToggleAnswer' | 'onBack'
>) {
  const answer =
    question.answer.trim().toUpperCase() === 'X'
      ? 'X'
      : 'O'

  return (
    <main
      className="question-view"
      style={{
        ...oxStyles.page,
        position: 'relative',
      }}
    >
      <QuestionAudioControl
        questionId={question.id}
        showAnswer={showAnswer}
      />

      <header style={oxStyles.toolbar}>
        <button style={oxStyles.toolbarButton} onClick={onBack}>
          <ArrowLeft size={18} />
          문제판
        </button>

        <span style={oxStyles.toolbarTitle}>
          {showAnswer ? 'OX 정답' : 'OX 문제'}
        </span>
      </header>

      {showAnswer ? (
        <section style={oxStyles.answerStage}>
          <div style={oxStyles.answerSymbol}>{answer}</div>
          <strong style={oxStyles.answerText}>정답입니다!</strong>
          <span style={oxStyles.answerScore}>+{question.score}점</span>
        </section>
      ) : (
        <section style={oxStyles.questionStage}>
          <div style={oxStyles.questionLabel}>문제</div>

          <div style={oxStyles.questionText}>
            {question.question}
          </div>

          <div style={oxStyles.choices} aria-label="O 또는 X 선택">
            <div style={oxStyles.choice}>O</div>
            <div style={oxStyles.choice}>X</div>
          </div>
        </section>
      )}

      <footer style={oxStyles.footer}>
        <button style={oxStyles.footerButton} onClick={onToggleAnswer}>
          {showAnswer ? <EyeOff size={21} /> : <Eye size={21} />}
          {showAnswer ? '문제 다시 보기' : '정답 보기'}
        </button>
      </footer>
    </main>
  )
}

export function QuestionPage({
  question,
  showAnswer,
  onToggleAnswer,
  onBack,
}: QuestionPageProps) {
  const type = question.type ?? 'general'
  const answerType = question.answerType ?? 'short'
  const isHiddenPicture = type === 'hidden'
  const isOx = type === 'ox'

  if (isOx) {
    return (
      <OxQuestionView
        question={question}
        showAnswer={showAnswer}
        onToggleAnswer={onToggleAnswer}
        onBack={onBack}
      />
    )
  }

  const questionImage =
    question.questionImageUrl ??
    ((type === 'image' || type === 'person' || type === 'hidden')
      ? question.mediaUrl
      : undefined)

  const visibleImage = showAnswer
    ? question.answerImageUrl ?? questionImage
    : questionImage

  const visibleText = showAnswer
    ? question.answer
    : question.question

  const choices = question.choices ?? []

  return (
    <main
      className="question-view"
      style={{ position: 'relative' }}
    >
      <QuestionAudioControl
        questionId={question.id}
        showAnswer={showAnswer}
      />

      <header className="question-toolbar">
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          문제판
        </button>

        <span>{showAnswer ? '정답' : '문제'}</span>
      </header>

      <section
        className={`question-stage ${
          isHiddenPicture ? 'hidden-picture-stage' : ''
        }`}
      >
        {isHiddenPicture ? (
          visibleImage ? (
            <img
              className="hidden-picture"
              src={visibleImage}
              alt={showAnswer ? '정답 표시 그림' : '숨은그림 원본'}
            />
          ) : (
            <div className="empty-media">이미지를 등록해 주세요.</div>
          )
        ) : (
          <>
            {type === 'video' && question.mediaUrl && (
              <div className="question-media">
                <video src={question.mediaUrl} controls preload="metadata" />
              </div>
            )}

            {type !== 'video' && visibleImage && (
              <div className="question-media">
                <img
                  src={visibleImage}
                  alt={showAnswer ? '정답 이미지' : '문제 이미지'}
                />
              </div>
            )}

            <div
              className={`question-text ${getTextSize(visibleText.length)}`}
            >
              {visibleText}
            </div>

            {!showAnswer &&
              answerType === 'multiple' &&
              choices.length > 0 && (
                <div className="choice-list">
                  {choices.map((choice, index) => (
                    <div
                      className={`choice ${getChoiceSize(choice.length)}`}
                      key={`${question.id}-${index}`}
                    >
                      <span>{index + 1}</span>
                      <strong>{choice}</strong>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}
      </section>

      <footer className="question-footer">
        <button onClick={onToggleAnswer}>
          {showAnswer ? <EyeOff size={21} /> : <Eye size={21} />}
          {isHiddenPicture
            ? showAnswer
              ? '원본 보기'
              : '정답 그림 보기'
            : showAnswer
              ? '문제 다시 보기'
              : '정답 보기'}
        </button>
      </footer>
    </main>
  )
}
