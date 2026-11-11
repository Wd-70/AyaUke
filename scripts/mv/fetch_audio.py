"""치지직 다시보기에서 클립 구간 오디오만 받는다 → work/<곡>/source.wav (44.1kHz 스테레오)

사용: python scripts/mv/fetch_audio.py samurai-heart --video 14887313 --start 9725 --end 9917
  --video  치지직 다시보기 번호(chzzk.naver.com/video/<번호>)
  --start/--end  클립 범위(다시보기 기준 초, approved-clips.json의 startTime/endTime)
  --pad    앞뒤 여유(초, 기본 5) — 파일 시각 = MV 시각 + pad. 이후 스크립트에 --offset 으로 넘긴다
yt-dlp는 치지직 추출이 깨져 있어(KeyError sourceURL) 사이트와 같은 방식으로 직접 받는다.
"""
import argparse
import json
import subprocess
import urllib.request

from common import FFMPEG, work_dir


def get(url: str, video: str):
    headers = {'User-Agent': 'Mozilla/5.0', 'Referer': f'https://chzzk.naver.com/video/{video}'}
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20).read())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('song')
    ap.add_argument('--video', required=True)
    ap.add_argument('--start', type=float, required=True)
    ap.add_argument('--end', type=float, required=True)
    ap.add_argument('--pad', type=float, default=5)
    a = ap.parse_args()

    c = get(f'https://api.chzzk.naver.com/service/v3/videos/{a.video}', a.video)['content']
    pb = get(f"https://apis.naver.com/neonplayer/vodplay/v2/playback/{c['videoId']}?key={c['inKey']}", a.video)
    audio = next(
        s['representation'][0]['baseURL'][0]['value']
        for p in pb['period'] for s in p['adaptationSet'] if s.get('mimeType') == 'audio/mp4'
    )
    out = work_dir(a.song) / 'source.wav'
    start = max(0.0, a.start - a.pad)
    subprocess.run([FFMPEG, '-y', '-v', 'error', '-ss', str(start), '-i', audio, '-t', str(a.end - start + a.pad),
                    '-vn', '-ar', '44100', '-ac', '2', str(out)], check=True)
    meta = {'video': a.video, 'start': a.start, 'end': a.end, 'offset': a.start - start, 'title': c.get('videoTitle')}
    (out.parent / 'source.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'file': str(out), **meta}, ensure_ascii=False))


if __name__ == '__main__':
    main()
