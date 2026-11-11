# MV 제작 도구 (로컬 전용)

클립 MV(`src/components/mv/works/<곡>/`)를 만들 때 쓰는 오디오 분석·가사 정렬·검수 도구.
무거운 파일(환경·모델·오디오)은 전부 `D:\cache` 아래에 두고 레포에는 스크립트만 둔다.

## 준비 (한 번)

```powershell
powershell -File scripts/mv/setup.ps1     # D:\cache\ayauke-mv\venv (CUDA PyTorch 2.8 + 정렬기·분리기)
```
이후 파이썬 스크립트는 `D:/cache/ayauke-mv/venv/Scripts/python.exe`로 실행한다(콘솔 한글은 `PYTHONIOENCODING=utf-8`).
설치 주의: audio-separator·faster-whisper 의존성이 torch를 CPU판 최신으로 바꿔 버린다 → setup.ps1이 마지막에 CUDA판(torch·torchaudio·torchvision)을 `--no-deps`로 다시 고정한다.

## 새 곡 순서

| 단계 | 명령 | 결과 (`D:\cache\ayauke-mv\work\<곡>\`) |
|---|---|---|
| 1. 오디오 | `python scripts/mv/fetch_audio.py <곡> --video <다시보기 번호> --start <s> --end <e>` | `source.wav`(44.1k 스테레오, 앞뒤 5초 여유), `source.json` |
| 2. 분리 | `python scripts/mv/separate.py <곡>` | `vocals.wav`, `instrumental.wav` (RTX 2060 약 3분) |
| 3. 분석 | `python scripts/mv/analyze.py <곡> --duration <클립 길이>` | `envelope.ts`(작품 폴더로 복사), `analysis.json` + 박·구간 후보·에너지·노래 구간 요약 |
| 4. 가사 | 아래 '가사 정렬' | `lyrics.aligned.json` → 작품 `lyrics.json`으로 |
| 5. 검수 | `node scripts/mv/sheet.mjs <클립 shareId> --every 2` | `D:\cache\ayauke-mv\sheets\*.jpg` 장면 모음 |

`<곡>`은 작업 폴더 이름(작품 폴더명과 같게, 예: `samurai-heart`).

### 가사 정렬 (`align_lyrics.py`, Qwen3-ForcedAligner)

이미 아는 가사를 소리에 맞춰 붙인다(받아 적기가 아니라 오청취 없음). 일본어·한국어·영어·중국어 등.

- **권장 — 줄 시작만 탭하고 나머지는 자동**: 편집기(`/mv/<id>/edit`)에서 노래를 들으며 줄마다 T로 시작만 탭(한 번 훑기) → 저장 →
  `python scripts/mv/align_lyrics.py <곡> --from-json src/components/mv/works/<곡>/lyrics.json --refine`
  → 줄 안의 덩어리 시각을 채운 초안. 편집기에서 다듬는다.
- **완전 자동(초안)**: `--lyrics 가사.txt --lang Japanese`. 절(verse)은 잘 맞지만 떼창·반주가 큰 후렴은 무너질 수 있다. 끝까지 못 맞춘 줄은 '확인 필요'로 출력되지만, 확정된 줄도 틀릴 수 있으니 반드시 들어 보고 고친다.
- 가사.txt: 한 줄 = 한 소절(부른 순서대로, 반복 후렴도 다 적기). 덩어리는 ` | `로 나누고, 탭 뒤에 번역(ko).
- `--lead 0.2`: 덩어리를 노래보다 살짝 먼저 띄우고 싶을 때.

**사무라이 하트로 잰 정확도**(손으로 맞춘 최종 타이밍 대비, 라이브·떼창 있는 곡):
| 방식 | 덩어리 시작 오차 |
|---|---|
| 완전 자동 | 앞 절(1~8줄)은 ±0.1~0.7초, 후렴·Hey!! 구간은 수십 초까지 무너짐 |
| 줄 시작 탭(±0.5초 흔들어도) + `--refine` | 줄 안 덩어리 중앙값 0.4초, 90%가 1초 이내 |

정렬기 특성(겪은 것):
- 가사보다 오디오가 훨씬 길면(3분 통째, 두 줄에 90초 등) 전부 0초로 무너진다 → 스크립트가 목소리 없는 구간을 잘라 붙이고 좁은 창으로 다시 맞춘다.
- 창 앞에 소리가 있으면 첫 단어 시작을 창 시작까지 끌어당긴다 → `--refine`은 그럴 때 탭한 시각을 쓴다.
- 떼창·MR 코러스의 "Hey!!" 같은 외침은 잘 못 잡는다.

## 로컬 AI 자원 (`D:\cache`)

| 위치 | 내용 | MV에서 |
|---|---|---|
| `hf\hub\models--Qwen--Qwen3-ForcedAligner-0.6B` | 다국어 강제 정렬(11개 언어, 일·한 포함) | **가사 정렬** |
| `ayauke-clip-analysis\models\audio-separator\model_bs_roformer_ep_317_sdr_12.9755.ckpt` | BS-RoFormer 보컬 분리(SDR 12.98) | **보컬/반주 분리** |
| `hf\hub\models--Systran--faster-whisper-large-v3`, `-medium` | 음성 인식 | 노래에는 부적합 — large-v3는 분리 보컬에서도 노래를 놓치고 "ご視聴ありがとうございました" 같은 환각. 가사 정렬에 쓰지 않는다 |
| `ayauke-clip-analysis\separation-venv`, `venv` | 클립↔MR 분석용 환경 | 건드리지 않는다(MV는 `ayauke-mv\venv` 따로) |
| `ayauke-clip-analysis\third-party\audfprint` | 오디오 지문(클립-MR 매칭) | 해당 없음 |
| `ayauke-clip-analysis\pip` | pip 휠 캐시(CUDA torch 등) | setup.ps1이 재사용 |

## 참고: 행글라이터 「클로드 코드 뮤비 만들기」

(`F:\Data\Git\DATA\행글라이터_클로드코드_뮤비만들기`, 출처: https://www.youtube.com/@hangglwriter)
p5.js로 mp4를 굽는 방식이라 그대로는 안 쓰고 아이디어만 가져왔다.
- 곡 전체 장면 모음으로 검수 → `sheet.mjs`
- 보컬 분리 후 강제 정렬 → `separate.py` + `align_lyrics.py`(원본은 demucs+MMS·한글 전용, 여기선 RoFormer+Qwen3·다국어)
- 아직 안 가져온 것: 수채화 붓(다각형 변형+반투명 겹칠 — 실시간 60fps라 정적 요소는 미리 그려 두는 식으로 옮겨야 함), 실제 박 목록 기반 박자(`analysis.json`의 `beats`에 이미 있음).
