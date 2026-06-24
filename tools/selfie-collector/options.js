const tokenInput = document.getElementById('token');
const saved = document.getElementById('saved');

chrome.storage.local.get('selfieToken').then(({ selfieToken }) => {
  if (selfieToken) tokenInput.value = selfieToken;
});

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ selfieToken: tokenInput.value.trim() });
  saved.textContent = '저장됨 ✓';
  setTimeout(() => { saved.textContent = ''; }, 1500);
});
