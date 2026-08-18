import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const contentDir = path.join(rootDir, 'content')
const questionsFile = path.join(contentDir, 'questions.json')
const backupFile = path.join(contentDir, 'backups', 'questions-previous.json')
const publicContentDir = path.join(rootDir, 'public', 'content')

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function safeExt(filename, contentType = '') {
  const ext = path.extname(filename).toLowerCase()
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext
  const byType = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
  }
  return byType[contentType] ?? '.bin'
}

function bibleBellContentPlugin() {
  return {
    name: 'biblebell-content-api',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const pathname = url.pathname.replace(/^\/BibleBell/, '')

          if (req.method === 'GET' && pathname === '/api/questions') {
            const text = fs.readFileSync(questionsFile, 'utf8')
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(text)
            return
          }

          if (req.method === 'POST' && pathname === '/api/questions') {
            const body = await readBody(req)
            const parsed = JSON.parse(body.toString('utf8'))
            if (!Array.isArray(parsed) || parsed.length !== 100) {
              sendJson(res, 400, { ok: false, message: '문제는 정확히 100개여야 합니다.' })
              return
            }
            fs.mkdirSync(path.dirname(backupFile), { recursive: true })
            const tempFile = `${questionsFile}.tmp`
            fs.writeFileSync(tempFile, JSON.stringify(parsed, null, 2), 'utf8')
            JSON.parse(fs.readFileSync(tempFile, 'utf8'))
            if (fs.existsSync(questionsFile)) fs.copyFileSync(questionsFile, backupFile)
            fs.renameSync(tempFile, questionsFile)
            sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
            return
          }

          if (req.method === 'POST' && pathname === '/api/media') {
            const questionId = String(req.headers['x-question-id'] ?? '').replace(/[^A-Za-z0-9_-]/g, '')
            const kind = String(req.headers['x-asset-kind'] ?? '')
            const originalName = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
            const allowed = {
              questionImage: 'images', answerImage: 'images', video: 'videos', audio: 'audio',
            }
            if (!questionId || !allowed[kind]) {
              sendJson(res, 400, { ok: false, message: '잘못된 미디어 요청입니다.' })
              return
            }
            const ext = safeExt(originalName, String(req.headers['content-type'] ?? ''))
            const suffix = kind === 'questionImage' ? 'question' : kind === 'answerImage' ? 'answer' : kind
            const filename = `${questionId}-${suffix}${ext}`
            const dir = path.join(contentDir, 'media', allowed[kind])
            fs.mkdirSync(dir, { recursive: true })
            const data = await readBody(req)
            if (!data.length) {
              sendJson(res, 400, { ok: false, message: '빈 파일입니다.' })
              return
            }
            const temp = path.join(dir, `${filename}.tmp`)
            const target = path.join(dir, filename)
            fs.writeFileSync(temp, data)
            fs.renameSync(temp, target)

            // Vite의 public 폴더에도 동일 파일을 복사합니다.
            // 이렇게 해야 개발 서버를 재시작하거나 빌드해도 /BibleBell/content/... 주소가 안정적으로 유지됩니다.
            const publicDir = path.join(publicContentDir, 'media', allowed[kind])
            fs.mkdirSync(publicDir, { recursive: true })
            const publicTarget = path.join(publicDir, filename)
            const publicTemp = `${publicTarget}.tmp`
            fs.writeFileSync(publicTemp, data)
            fs.renameSync(publicTemp, publicTarget)

            const publicUrl = `/BibleBell/content/media/${allowed[kind]}/${filename}`
            sendJson(res, 200, { ok: true, url: publicUrl, filename })
            return
          }

          if (req.method === 'GET' && pathname.startsWith('/content/')) {
            const relative = pathname.slice('/content/'.length)
            const target = path.resolve(contentDir, relative)
            if (!target.startsWith(path.resolve(contentDir)) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
              next(); return
            }
            const ext = path.extname(target).toLowerCase()
            const types = {
              '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
              '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
            }
            res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
            fs.createReadStream(target).pipe(res)
            return
          }

          next()
        } catch (error) {
          console.error(error)
          sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : '저장 오류' })
        }
      })
    },
  }
}

export default defineConfig({
  base: '/BibleBell/',
  plugins: [react(), bibleBellContentPlugin()],
})
