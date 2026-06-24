/**
 * 방종셀카 채팅창 크롭 전처리.
 *
 * 방종셀카는 거의 같은 레이아웃(왼쪽=방송 모델 화면, 오른쪽=채팅창)이라,
 * 닉네임 추출에 불필요한 왼쪽을 잘라내고 오른쪽 채팅창만 남기면 판독이 쉬워진다.
 * 채팅창 너비가 조금씩 다를 수 있으므로 기본값은 여유를 둔다(오른쪽 32%).
 * 나중에 읽다가 채팅이 잘리면 --ratio 를 낮춰(더 넓게) 재실행하면 된다.
 *
 * 사용:
 *   node scripts/selfie/crop-chat.mjs --date=2025-12-19
 *   node scripts/selfie/crop-chat.mjs --date=2025-12-19 --ratio=0.62   # 더 넓게
 *
 * 결과: selfie-archive/<date>/_chat/<원본파일명>  (원본은 보존)
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
  }),
)

const date = args.date
const ratio = args.ratio ? Number(args.ratio) : 0.68 // 왼쪽 경계 비율(이 지점부터 오른쪽 끝까지 크롭)
const scale = args.scale ? Number(args.scale) : 2 // 판독 편의를 위한 업스케일 배율
const outDir = args.out || '_chat'

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('사용법: node scripts/selfie/crop-chat.mjs --date=YYYY-MM-DD [--ratio=0.68]')
  process.exit(1)
}
if (!(ratio > 0 && ratio < 1)) {
  console.error('--ratio 는 0~1 사이여야 합니다.')
  process.exit(1)
}

const srcDir = path.join(process.cwd(), 'selfie-archive', date)
const dstDir = path.join(srcDir, outDir)

const files = (await fs.readdir(srcDir).catch(() => []))
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))

if (files.length === 0) {
  console.error(`이미지가 없습니다: ${srcDir}`)
  process.exit(1)
}

await fs.mkdir(dstDir, { recursive: true })

let done = 0
for (const f of files) {
  const src = path.join(srcDir, f)
  try {
    const img = sharp(src)
    const meta = await img.metadata()
    const W = meta.width || 0
    const H = meta.height || 0
    const left = Math.round(W * ratio)
    const width = W - left
    if (width <= 0) {
      console.warn(`건너뜀(폭 0): ${f}`)
      continue
    }
    let pipe = img.extract({ left, top: 0, width, height: H })
    if (scale && scale !== 1) pipe = pipe.resize(Math.round(width * scale), Math.round(H * scale), { kernel: 'lanczos3' })
    await pipe.toFile(path.join(dstDir, f))
    done += 1
    console.log(`✓ ${f}  ${W}x${H} → ${Math.round(width * scale)}x${Math.round(H * scale)} (left=${left}, x${scale})`)
  } catch (e) {
    console.warn(`실패: ${f} — ${e.message}`)
  }
}

console.log(`\n완료: ${done}/${files.length}장 → selfie-archive/${date}/${outDir}/  (ratio=${ratio})`)
