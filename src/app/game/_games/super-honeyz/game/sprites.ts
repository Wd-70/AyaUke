/**
 * 게임용 스프라이트 시트 로더.
 * public/game/super-honeyz/<name>.png + <name>.json 을 불러온다.
 * (json은 scripts/assets/process-sprites.mjs 가 생성)
 */
export interface SpriteSheet {
  img: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  ready: boolean;
}

const BASE = '/game/super-honeyz';

export function loadSheet(name: string): SpriteSheet {
  const sheet: SpriteSheet = {
    img: new Image(),
    frameWidth: 0,
    frameHeight: 0,
    frames: 1,
    ready: false,
  };

  fetch(`${BASE}/${name}.json`)
    .then((r) => r.json())
    .then((meta) => {
      sheet.frameWidth = meta.frameWidth;
      sheet.frameHeight = meta.frameHeight;
      sheet.frames = meta.frames;
      sheet.img.onload = () => {
        sheet.ready = true;
      };
      sheet.img.src = `${BASE}/${meta.image}`;
    })
    .catch(() => {
      /* 메타 로드 실패 시 ready=false 유지 → 도형 폴백 */
    });

  return sheet;
}

/**
 * 시트의 한 프레임을 그린다.
 * (footX, footY) = 캐릭터 발 중앙이 놓일 위치, drawH = 화면상 그릴 높이.
 * faceLeft=true 이면 좌우 반전.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  frame: number,
  footX: number,
  footY: number,
  drawH: number,
  faceLeft: boolean,
) {
  if (!sheet.ready) return false;
  const fw = sheet.frameWidth;
  const fh = sheet.frameHeight;
  const drawW = (drawH * fw) / fh;
  const sx = (frame % sheet.frames) * fw;
  const dy = footY - drawH;

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  if (faceLeft) {
    // footX 기준 좌우 반전 → 그대로 중앙(-drawW/2)에 그림
    ctx.translate(footX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.img, sx, 0, fw, fh, -drawW / 2, dy, drawW, drawH);
  } else {
    ctx.drawImage(sheet.img, sx, 0, fw, fh, footX - drawW / 2, dy, drawW, drawH);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}
