/* 방종셀카 수집기 — 팝업.
 * 주입 함수(scanFrame/dumpFrame/mergeCandidates)는 inject.js에서 전역으로 제공된다.
 * chrome.scripting.executeScript({allFrames:true}) 로 모든 프레임(카페 본문 iframe 포함)에서
 * 스캔/덤프를 실행하고 결과를 합친다. */

const $ = (s) => document.querySelector(s);
let candidates = [];

// 토큰 / 에이전트 상태 표시
chrome.storage.local.get(['selfieToken', 'agentEnabled']).then(({ selfieToken, agentEnabled }) => {
  if (!selfieToken) $('#status').textContent = '⚠ 먼저 확장 옵션에서 토큰을 설정하세요 (확장 우클릭 → 옵션).';
  const cb = $('#agent');
  if (cb) cb.checked = !!agentEnabled;
  reflectAgent(!!agentEnabled);
});

function reflectAgent(on) {
  const el = $('#agentState');
  if (el) el.textContent = on ? '에이전트 ON (서버 명령 대기 중)' : '에이전트 OFF';
}

function serverMsg(resp) {
  if (resp && resp.data && resp.data.error && resp.data.error.message) return resp.data.error.message;
  if (resp && resp.status === 0) return 'dev 서버 연결 실패(서버 켜짐 확인)';
  return resp ? `HTTP ${resp.status}` : '확장 통신 실패';
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** 모든 프레임에서 func 실행 → 각 프레임 result 배열 반환 */
async function runAllFrames(func) {
  const tab = await activeTab();
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func,
  });
  return { tab, results: results.map((r) => r.result).filter(Boolean) };
}

function fmtDate(iso) { try { return new Date(iso || Date.now()).toLocaleDateString('ko-KR'); } catch (_) { return '(날짜?)'; } }

function render() {
  const list = $('#list'); list.innerHTML = '';
  $('#ingest').disabled = candidates.length === 0;
  if (candidates.length === 0) { $('#status').textContent = '셀카 후보를 찾지 못했습니다. 본문이 보이는 글에서 다시 시도하거나 개발용 덤프를 보내주세요.'; return; }
  $('#status').textContent = `${candidates.length}개 게시물 후보 — 확인 후 '선택 수집'`;
  candidates.forEach((c, i) => {
    const div = document.createElement('div'); div.className = 'cand';
    const thumbs = c.images.map((im) => `<img src="${im.imageUrl}" referrerpolicy="no-referrer" />`).join('');
    div.innerHTML =
      `<label><input type="checkbox" data-i="${i}" checked /> ${fmtDate(c.postedAt)} · ${c.images.length}장 · ${c.source.toUpperCase()}</label>` +
      `<div class="thumbs">${thumbs}</div>` +
      `<div class="src">${c.sourceUrl}</div>`;
    list.appendChild(div);
  });
}

$('#scan').addEventListener('click', async () => {
  $('#status').textContent = '스캔 중...';
  try {
    const { results } = await runAllFrames(scanFrame);
    candidates = mergeCandidates(results);
    render();
  } catch (e) {
    $('#status').textContent = '스캔 실패: ' + String(e);
  }
});

$('#dump').addEventListener('click', async () => {
  $('#status').textContent = '덤프 수집 중...';
  try {
    const { tab, results } = await runAllFrames(dumpFrame);
    const payload = { capturedAt: new Date().toISOString(), pageUrl: tab.url, frames: results };
    chrome.runtime.sendMessage({ type: 'dump', payload }, async (resp) => {
      if (chrome.runtime.lastError || !resp) {
        $('#status').textContent = '덤프 전송 실패(확장 통신). 확장을 새로고침해 보세요.';
        return;
      }
      if (resp.ok) {
        $('#status').textContent = `덤프 저장됨: ${resp.data.path}\n프레임 ${results.length}개. 이 경로를 Claude에게 알려주세요.`;
        try { await navigator.clipboard.writeText(resp.data.path || ''); } catch (_) {}
      } else {
        $('#status').textContent = `덤프 전송 실패: ${serverMsg(resp)}`;
      }
    });
  } catch (e) {
    $('#status').textContent = '덤프 실패: ' + String(e);
  }
});

$('#ingest').addEventListener('click', () => {
  const selected = [...document.querySelectorAll('#list input[type=checkbox]:checked')]
    .map((cb) => candidates[Number(cb.dataset.i)]).filter(Boolean);
  if (selected.length === 0) return;
  $('#ingest').disabled = true;
  $('#status').textContent = `${selected.length}개 전송 중...`;
  chrome.runtime.sendMessage({ type: 'ingest', candidates: selected }, (resp) => {
    $('#ingest').disabled = false;
    if (chrome.runtime.lastError || !resp) {
      $('#status').textContent = '전송 실패 — localhost:3000 dev 서버와 토큰을 확인하세요.';
      return;
    }
    const ok = resp.results.filter((r) => r.ok).length;
    const added = resp.results.reduce((s, r) => s + (r.data && r.data.addedImages ? r.data.addedImages : 0), 0);
    if (ok === 0) {
      const first = resp.results[0];
      $('#status').textContent = `수집 실패: ${serverMsg(first)}`;
    } else {
      $('#status').textContent = `완료: ${ok}/${resp.results.length} 게시물 성공, 이미지 ${added}장 신규 저장`;
    }
  });
});

// 에이전트(서버→확장 명령 폴링) 토글
const agentCb = $('#agent');
if (agentCb) {
  agentCb.addEventListener('change', () => {
    const enabled = agentCb.checked;
    chrome.runtime.sendMessage({ type: 'agentToggle', enabled }, () => {});
    reflectAgent(enabled);
  });
}
