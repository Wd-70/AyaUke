// Isolated UI fixture: no application server, credentials, or real DB connections.
// Run: node scripts/qa/song-library-preview.mjs
import { build } from 'vite';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const result = await build({
  configFile: false, logLevel: 'silent', oxc: { jsx: { runtime: 'automatic', development: false } },
  resolve: { alias: { '@': path.join(root, 'src') } }, define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'song-library-fixture', enforce: 'pre',
    resolveId(id) {
      if (id === 'react-youtube') return '\0youtube.tsx';
      if (id.endsWith('/useLikes')) return '\0likes';
      if (id.endsWith('/useGlobalPlaylists')) return '\0playlists';
      if (id.endsWith('/ClipRangeProvider')) return '\0range';
      if (id.endsWith('/RecordingLibrary') || id === './LiveClipManager' || id === './PlaylistContextMenu') return '\0noop';
 if (id === 'fixture') return '\0fixture.tsx'; if (id === 'next-auth/react') return '\0session'; },
    load(id) {
      if (id === '\0youtube.tsx') return 'export default function Video(){return <div>테스트 MR 플레이어</div>}';
      if (id === '\0likes') return 'export const useLike=()=>({liked:false,isLoading:false,toggleLike:()=>{}});';
      if (id === '\0playlists') return 'export const useSongPlaylists=()=>({playlists:[]});';
      if (id === '\0range') return 'export const useClipRangeEditor=()=>({isOpen:false});';
      if (id === '\0noop') return 'export default function Noop(){return null;}';

      if (id === '\0session') return "export const useSession = () => ({data:{user:{role:'user',adminScopes:['songs']}}});";
      if (id === '\0fixture.tsx') return `import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; const qaClient = new QueryClient(); window.qaClient=qaClient; import SongDetailModal from '@/components/SongDetailModal'; import SongEditForm from '@/components/SongEditForm'; import {ToastProvider} from '@/components/Toast'; import Songs from '${path.join(root, 'src/app/admin/tabs/songs/SongManagementTab.tsx').replaceAll('\\', '/')}'; function DetailQA(){const [song,setSong]=React.useState({id:'000000000000000000000001',title:'테스트 원제',artist:'원본 가수',language:'Japanese',source:'mongodb',mrLinks:[{url:'https://youtu.be/abcdefghijk',label:'기존 MR',skipSeconds:8}],selectedMRIndex:0}); const [open,setOpen]=React.useState(true); return <><button onClick={()=>setOpen(true)}>상세 열기</button><SongDetailModal song={song} onSongUpdated={setSong} isExpanded={open} onClose={()=>setOpen(false)} isMobileScreen={innerWidth<768} songVideos={[]} setSongVideos={()=>{}} videosLoading={false} loadSongVideos={async()=>{}} /></>;} createRoot(document.getElementById('root')).render(<QueryClientProvider client={qaClient}><main style={{maxWidth:1200,margin:"auto",padding:16}}>{new URLSearchParams(location.search).has('detail') ? <ToastProvider><DetailQA/></ToastProvider> : new URLSearchParams(location.search).has('songbook') ? <ToastProvider><div style={{height:'90dvh',display:'flex',flexDirection:'column'}}><SongEditForm song={{id:'000000000000000000000001',title:'夜に駆ける',artist:'YOASOBI',language:'Japanese',mrLinks:[{url:'https://youtu.be/abcdefghijk',skipSeconds:8,label:'기존 MR'}],selectedMRIndex:0}} isVisible onSave={()=>{}} onCancel={()=>{}} /></div></ToastProvider> : <Songs/>}</main></QueryClientProvider>);`;
    },
  }],
  build: { write: false, minify: false, rollupOptions: { input: 'fixture', output: { inlineDynamicImports: true } } },
});
const bundle = (Array.isArray(result) ? result[0] : result).output.filter(o => o.type === 'chunk').map(o => o.code).join('\n');
const require = createRequire(import.meta.url);
const css = (await postcss([tailwindcss({ ...require(path.join(root, 'tailwind.config.js')), content: [path.join(root, 'src/app/admin/tabs/songs/*.tsx'), path.join(root, 'src/components/*.tsx'), path.join(root, 'src/components/song-editor/*.tsx')] })])
  .process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })).css;
const values = { titleAlias: '', artistAlias: '', language: 'Japanese', searchTags: ['애니메이션'], lyrics: '', personalNotes: '', imageUrl: '', keyAdjustment: null, clipDuration: 240, mrLinks: [{ url: 'https://youtu.be/abcdefghijk', label: '원곡 MR', duration: '4:00', skipSeconds: 8 }, { url: 'https://youtu.be/lmnopqrstuv', label: '커버 버전', duration: '4:02', skipSeconds: 0 }], selectedMRIndex: 1 };
let songs = Array.from({ length: 29 }, (_, i) => ({
  id: String(i + 1).padStart(24, '0'), title: i === 0 ? '残酷な天使のテーゼ' : ['夜に駆ける', 'This Is Me', 'Sorаnji', 'カタオモイ', 'Lemon'][i % 5] + ` ${i + 1}`,
  artist: i === 0 ? '高橋洋子' : ['YOASOBI', 'Mrs. GREEN APPLE', 'Aimer', '米津玄師'][i % 4],
  titleAlias: i === 0 ? '잔혹한 천사의 테제' : '', artistAlias: '', language: i % 3 ? 'Japanese' : 'English',
  searchTags: ['애니메이션'], imageUrl: '', mrCount: 2, selectedMR: values.mrLinks[1], hasLyrics: i % 4 === 0,
  clipDuration: i % 3 ? null : 240, keyAdjustment: null, status: i === 28 ? 'deleted' : 'active', sourceType: i % 2 ? 'sheet' : 'admin',
  clips: 17 - (i % 17), verifiedClips: 2, likeCount: 3, lastSungDate: null,
  updatedAt: '2026-11-15T03:00:00.000Z', createdAt: '2025-05-01T00:00:00.000Z', deleteReason: '', displayConflicts: 0,
  values: { ...structuredClone(values), titleAlias: i === 0 ? '잔혹한 천사의 테제' : '', clipDuration: i % 3 ? null : 240, language: i % 3 ? 'Japanese' : 'English', lyrics: i % 4 === 0 ? '테스트 가사' : '' },
}));
const sync = song => {
  Object.assign(song, song.values, { selectedMR: song.values.mrLinks[song.values.selectedMRIndex] || null, mrCount: song.values.mrLinks.length, hasLyrics: !!song.values.lyrics.trim(), updatedAt: new Date().toISOString() });
  return song;
};
let searchCalls = 0; const requests = {};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { const name = req.method + ' ' + url.pathname; requests[name] = (requests[name] || 0) + 1; }
  const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/qa/cover.svg') {
    res.writeHead(200, {'Content-Type':'image/svg+xml'});
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#7c3aed"/><circle cx="120" cy="80" r="42" fill="#c4b5fd"/></svg>');
  }
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="ko" ${url.searchParams.has('dark') ? 'class="dark"' : ''}><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body class="bg-slate-50 dark:bg-slate-950"><div id="root"></div><script type="module">${bundle}</script></body></html>`);
    return;
  }
  if (url.pathname === '/api/youtube/metadata') {
    const videoId = new URL(url.searchParams.get('url')).searchParams.get('v');
    return send({ success:true, metadata: {title:'테스트 영상 제목 ' + videoId, channelTitle:'테스트 MR 채널'} });
  }
  if (url.pathname === '/qa/requests') return send(requests);
  if (url.pathname === '/qa/search-count') return send({ searchCalls });
  if (req.method === 'GET' && url.pathname === '/api/admin/song-library') return send({ success: true, data: { songs } });
  const id = url.pathname.split('/').at(-1);
  const song = songs.find(s => s.id === id);
  if (req.method === 'GET' && url.pathname.endsWith('/stats')) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return send({success:true,data:{clips:17,verifiedClips:2}});
  }
  if (req.method === 'GET' && song) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return send({ success: true, data: {...song, statsLoaded:false} });
  }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  if (req.method === 'PUT' && url.pathname.startsWith('/api/songdetails/')) {
    if (body.titleAlias === '저장실패') return send({success:false,error:{message:'테스트 저장 실패'}},500);
    return send({success:true,data:{song:{...body,id,title:'테스트 원제',artist:'원본 가수',language:body.language}}});
  }
  if (url.pathname === '/api/youtube/metadata/batch') return send({success:true, metadata:Object.fromEntries(body.ids.map(id=>[id,{title:'테스트 영상 제목 '+id,channelTitle:'테스트 MR 채널'}]))});
  if (url.pathname === '/api/youtube-search') {
    searchCalls++;
    if (body.query === 'error') return send({ success:false, error:'테스트: 검색 할당량 초과' }, 503);
    const preferred = body.language === 'Japanese';
    const candidate = (videoId, title, channelTitle, priority = false) => ({ videoId, title, channelTitle, channelId: priority ? 'UCrdNFs5BEnMkUsnexngzq5A' : 'fixture', preferred: priority, url: 'https://www.youtube.com/watch?v=' + videoId, thumbnail: 'https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg' });
    return send({ success:true, searchQuery:body.query || body.title, excludedCount:body.language === 'Korean' ? 2 : 0, warnings:[],
      results: body.query === 'empty' ? [] : [candidate('12345678901', body.title + ' &amp; MR [원곡 키]', preferred ? '떡뮤 노래방' : '독립 MR 채널', preferred), candidate('abcdefghijk', '기존 MR 영상', '독립 채널'), candidate('98765432109', '다른 버전 MR', '커버 MR')] });
  }
  if (req.method === 'PATCH' && song) {
    if (body.expectedUpdatedAt !== song.updatedAt) return send({ success: false, error: { message: '다른 작업에서 변경되었습니다.' } }, 409);
    if (body.action === 'edit') { song.values = body.values; sync(song); }
    else { song.status = body.action === 'archive' ? 'deleted' : 'active'; song.deleteReason = body.reason || ''; song.updatedAt = new Date().toISOString(); }
    return send({ success: true, data: song });
  }
  if (req.method === 'POST' && id === 'bulk') {
    const changed = [];
    for (const target of body.targets) { const s = songs.find(s => s.id === target.id); if (!s) continue;
      s.values[body.change.field] = body.change.field === 'searchTags' ? [...new Set([...s.values.searchTags, ...body.change.value])] : body.change.value;
      sync(s); changed.push(s.id); }
    return send({ success: true, data: { changed, conflicts: [], updated:songs.filter(song=>changed.includes(song.id)) } });
  }
  if (req.method === 'POST') {
    const added = { ...structuredClone(songs[0]), id: String(Date.now()).padStart(24, '0'), title: body.title, artist: body.artist, values: body.values, status: 'active', clips: 0, verifiedClips: 0, likeCount: 0, sourceType: 'admin' };
    sync(added); songs.unshift(added); return send({ success: true, data: added }, 201);
  }
  send({ success: false, error: { message: '없는 테스트 경로' } }, 404);
});
server.listen(43219, '127.0.0.1', () => console.log('Isolated song library fixture: http://127.0.0.1:43219'));
