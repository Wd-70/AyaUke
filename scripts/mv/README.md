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
| 0. 곡 조사 | 웹 검색(아래 '곡 조사') | 기획서 `src/components/mv/works/<곡>/PLAN.md`의 '곡 정보' |
| 1. 오디오 | `python scripts/mv/fetch_audio.py <곡> --video <다시보기 번호> --start <s> --end <e>` | `source.wav`(44.1k 스테레오, 앞뒤 5초 여유), `source.json` |
| 2. 분리 | `python scripts/mv/separate.py <곡>` | `vocals.wav`, `instrumental.wav` (RTX 2060 약 3분) |
| 3. 분석 | `python scripts/mv/analyze.py <곡> --duration <클립 길이>` | `envelope.ts`(작품 폴더로 복사), `analysis.json` + 박·구간 후보·에너지·노래 구간·음높이·고음 후보 요약 |
| 4. 가사 | 아래 '가사 정렬' | `lyrics.aligned.json` → 작품 `lyrics.json`으로 |
| 5. 구간별 기획 | 조사 + 분석 결과로 `PLAN.md` 작성(아래 '기획 원칙') → 사용자 확인 | 장면·구도·기법 표, cue 이름 |
| 6. 제작 | 작품 코드(`scene.ts`·`timeline.ts`·`cues.json`) | |
| 7. 검수 | `node scripts/mv/sheet.mjs <클립 shareId> --every 2` | `D:\cache\ayauke-mv\sheets\*.jpg` 장면 모음 — 같은 그림이 이어지는 칸이 없는지 본다 |
| 8. 성능 | `node scripts/mv/perf.mjs <클립 shareId> 3,10,64` | 시각별 프레임 시간 — 16.7ms를 넘는 장면은 스프라이트·Path2D 묶음으로 줄인다 |
| 9. 전환 | `node scripts/mv/motion.mjs <클립 shareId>` | 장면마다 움직임 흐름과 '끝에서 멈춤' 표시 — 렌더러가 `scenes()`를 내놓아야 함 |
| 10. 원본 영상 | `node scripts/mv/live.mjs <클립 shareId> 52,121,175` | 실제로 재생하며 캔버스를 찍음(`?t=` 정지 모드엔 원본 영상이 없음) → `sheets\<id>-live-<시각>.jpg` |

`<곡>`은 작업 폴더 이름(작품 폴더명과 같게, 예: `samurai-heart`).

### 곡 조사 (0단계)

대부분 원곡이 있는 커버라 웹에 정보가 많다. 직접 분석(박·음높이)으로는 알 수 없는 것을 찾는다.
- 원곡: 작사·작곡, 수록 앨범, 타이업(애니·영화·드라마), 다른 버전(어쿠스틱 등)
- 의미: 가사 해설·인터뷰에서 곡의 주제, 반복되는 이미지(꽃·계절·색), 화자의 감정선
- 공식 MV·타이업 작품의 장면은 **재현하지 않으려고** 확인한다(구도·캐릭터·상징을 그대로 가져오지 않는다). 우리 MV의 이미지는 가사와 곡 구조에서 직접 만든다.
- 출처 URL을 PLAN.md에 남긴다(사이트에 따라 403이 나면 다른 출처로).

### 기획 원칙 (5단계)

- **끊을 수 있는 곳마다 새 장면**: 구간 경계뿐 아니라 프레이즈(가사 1~2줄, 보통 2~4마디)마다 바꾼다. 같은 장소·소재를 다시 쓰더라도 구도(와이드↔클로즈업, 정면↔옆↔위, 좌우 배치, 카메라 이동 방향)를 바꾼다.
- **기법 전환**: 곡의 느낌에 따라 표현 방식을 갈아탄다(수채화 번짐, 그려지는 선화, 실루엣·역광, 입자, 키네틱 타이포, 분할 화면, 원본 영상 프레임 등). 한 기법이 한 구간 넘게 이어지지 않게.
- **낙차 설계**: 작게 부르는 절·브릿지·무음은 감성 연출로 눌러 두고(색·밝기·움직임을 아낌), 전조·최고음·마지막 후렴에서 푼다. 분석 요약의 에너지·음높이·고음 후보로 시각을 잡는다.
- PLAN.md 표: 시각(MV 기준) · 가사 · 데이터 · 장면 · 구도 · 기법 · 전환. 시각은 가사 정렬이 끝나면 줄 시작에 맞춘다.
- **움직이는 채로 컷**: 장면의 연출이 전환 전에 끝나 화면이 멈춘 채 넘어가면 어색하다(카타포 검수에서 지적됨).
  - 카메라 이동에 `smooth(k)`·`easeOutCubic(k)`처럼 끝에서 감속하는 곡선을 쓰지 않는다 — 선형이나 끝으로 갈수록 빨라지는 곡선으로.
  - 장면 안 애니메이션(피어남·그려짐·갈라짐)이 일찍 끝나면 그 뒤에도 무언가(카메라·입자·회전·빛)가 계속 움직이게.
  - '마지막 반 박 정지' 같은 시간 멈춤은 쓰지 않는다. 겹쳐 사라지는 동안 앞 장면의 `k`는 1을 넘어 계속 간다.
  - 확대한 카메라를 한쪽 점으로 옮기면(`cam`) 가장자리가 빈다 — 그 점을 제자리에 두고 확대(`zoomAt`)하거나 배경을 넓게 그린다.
- **원본 영상을 여러 칸에**: 칸마다 같은 화면이면 복사해 붙인 듯 보인다 → `kit.footage(..., delay)`로 칸마다 조금 전의 순간을 쓴다(렌더러가 원본 장면 근처에서 지난 몇 초를 기억).

### 가사 정렬 (`align_lyrics.py`, Qwen3-ForcedAligner)

이미 아는 가사를 소리에 맞춰 붙인다(받아 적기가 아니라 오청취 없음). 일본어·한국어·영어·중국어 등.

- **권장 — 줄 시작만 탭하고 나머지는 자동**: 편집기(`/mv/<id>/edit`)에서 노래를 들으며 줄마다 T로 시작만 탭(한 번 훑기) → 저장 →
  `python scripts/mv/align_lyrics.py <곡> --from-json src/components/mv/works/<곡>/lyrics.json --refine`
  → 줄 안의 덩어리 시각을 채운 초안. 편집기에서 다듬는다.
- **완전 자동(초안)**: `--lyrics 가사.txt --lang Japanese --anchors 1@8.5,6@31.5,15@76`. 절(verse)·브릿지처럼 작게 부르는 곳은 잘 맞지만 크게 지르는 후렴은 무너진다. 끝까지 못 맞춘 줄은 '확인 필요'로 출력되지만, 확정된 줄도 틀릴 수 있으니 반드시 들어 보고 고친다.
- `--anchors 줄번호@MV시각,…`: 분석 요약의 에너지·음높이로 보이는 절·프리코러스·브릿지 시작을 알려 주면 구간마다 따로 맞춘다. 닻 없이 곡 전체를 한 번에 맞추면 한 구간이 틀리면서 뒤가 줄줄이 밀린다(카타포에서 2절 첫 줄이 50초로 감).
- 가사.txt: 한 줄 = 한 소절(부른 순서대로, 반복 후렴도 다 적기). 덩어리는 ` | `로 나누고, 탭 뒤에 번역(ko).
- `--lead 0.2`: 덩어리를 노래보다 살짝 먼저 띄우고 싶을 때.

**사무라이 하트로 잰 정확도**(손으로 맞춘 최종 타이밍 대비, 라이브·떼창 있는 곡):
| 방식 | 덩어리 시작 오차 |
|---|---|
| 완전 자동 | 앞 절(1~8줄)은 ±0.1~0.7초, 후렴·Hey!! 구간은 수십 초까지 무너짐 |
| 줄 시작 탭(±0.5초 흔들어도) + `--refine` | 줄 안 덩어리 중앙값 0.33초, 90%가 1초 이내 |

정렬기 특성(겪은 것):
- 가사보다 오디오가 훨씬 길면(3분 통째, 두 줄에 90초 등) 전부 0초로 무너진다 → 스크립트가 목소리 없는 구간을 잘라 붙이고 좁은 창으로 다시 맞춘다.
- 창 앞에 소리가 있으면 첫 단어 시작을 창 시작까지 끌어당긴다 → `--refine`은 그럴 때 탭한 시각을 쓴다.
- 크게 지르는 후렴(길게 끄는 음·바이브레이션)은 분리 보컬로도 원본 믹스로도 무너진다 — 떼창이 없는 카타포에서도 같았다. 후렴은 줄 시작 탭이 필요하다.
- 떼창·MR 코러스의 "Hey!!" 같은 외침도 잘 못 잡는다.
- 목소리 판정 기준은 가장 큰 소리의 -30dB(`voice_mask`). 처음엔 -18dB였는데, 절을 후렴보다 18dB 작게 부르는 카타포에서 절 전체가 '목소리 없음'으로 잘려 나가 정렬이 통째로 무너졌다. 낮춘 뒤 사무라이 하트도 조금 나아졌다(탭+`--refine` 중앙값 0.33초).

### 음높이·고음 후보 (`analyze.py`)

분리 보컬을 pyin으로 재서 0.5초마다 음높이(MIDI)와, 곡 최고음 근처(2.5반음 안)를 0.4초 넘게 끈 '고음 후보'를 낸다.
지르는 순간·전조(키 올림)·작게 부르는 절을 찾아 연출의 낙차를 짜는 데 쓴다. 카타포: 마지막 후렴(166.8초)에서 반음 전조,
고음 후보 178.9초 F5·195.8초 A5.

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
- 수채화 붓 → `src/components/mv/paint.ts`(`washSprite`·`wash`·`washBackdrop` — 번짐을 스프라이트로 미리 그려 두고 찍는다). 연필 선(`pencil`)·종이결(`paperGrain`)도 같은 파일.
- 아직 안 가져온 것: 실제 박 목록 기반 박자(`analysis.json`의 `beats`에 이미 있음).
