/* 방종셀카 수집기 — 팝업.
 * 현재 탭을 스캔해 후보를 보여주고, 선택분을 백그라운드로 보내 수집한다. */

const $ = (s) => document.querySelector(s);
let candidates = [];

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function fmtDate(iso) {
  try { return new Date(iso || Date.now()).toLocaleDateString('ko-KR'); } catch (_) { return '(날짜?)'; }
}

function render() {
  const list = $('#list');
  list.innerHTML = '';
  $('#ingest').disabled = candidates.length === 0;
  if (candidates.length === 0) { $('#status').textContent = '셀카 후보를 찾지 못했습니다.'; return; }
  $('#status').textContent = `${candidates.length}개 게시물 후보 — 확인 후 '선택 수집'`;
  candidates.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'cand';
    const thumbs = c.images.map((im) => `<img src="${im.imageUrl}" referrerpolicy="no-referrer" />`).join('');
    div.innerHTML =
      `<label><input type="checkbox" data-i="${i}" checked /> ${fmtDate(c.postedAt)} · ${c.images.length}장 · ${c.source.toUpperCase()}</label>` +
      `<div class="thumbs">${thumbs}</div>` +
      `<div class="src">${c.sourceUrl}</div>`;
    list.appendChild(div);
  });
}

$('#scan').addEventListener('click', async () => {
  const tab = await activeTab();
  $('#status').textContent = '스캔 중...';
  chrome.tabs.sendMessage(tab.id, { type: 'scan' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      $('#status').textContent = '스캔 실패 — 페이지를 새로고침한 뒤 다시 시도하세요.';
      return;
    }
    candidates = resp.candidates || [];
    render();
  });
});

$('#ingest').addEventListener('click', () => {
  const selected = [...document.querySelectorAll('#list input[type=checkbox]:checked')]
    .map((cb) => candidates[Number(cb.dataset.i)])
    .filter(Boolean);
  if (selected.length === 0) return;
  $('#ingest').disabled = true;
  $('#status').textContent = `${selected.length}개 전송 중... (로컬 서버 + 관리자 로그인 필요)`;
  chrome.runtime.sendMessage({ type: 'ingest', candidates: selected }, (resp) => {
    $('#ingest').disabled = false;
    if (chrome.runtime.lastError || !resp) {
      $('#status').textContent = '전송 실패 — localhost:3000 dev 서버와 관리자 로그인을 확인하세요.';
      return;
    }
    const ok = resp.results.filter((r) => r.ok).length;
    const added = resp.results.reduce((s, r) => s + (r.data && r.data.addedImages ? r.data.addedImages : 0), 0);
    $('#status').textContent = `완료: ${ok}/${resp.results.length} 게시물 성공, 이미지 ${added}장 신규 저장`;
  });
});
