/**
 * 방종셀카 수집 에이전트 — 서버→확장 명령 큐 (개발용, 인메모리).
 *
 * 확장이 직접 호출될 수는 없으므로, 서버가 명령을 큐에 쌓아두고 확장이 long-poll로 가져가 실행한 뒤
 * 결과를 다시 서버에 기록한다. Claude는 enqueue로 명령을 넣고 getResult로 결과를 읽어 수집을 원격 조종한다.
 *
 * 로컬 단일 프로세스 dev 전용. 프로세스 재시작/HMR 시 휘발된다(개발 세션 동안만 유지).
 */

export interface AgentCommand {
  id: string
  type: string
  payload?: unknown
  enqueuedAt: number
}

export interface AgentResult {
  id: string
  ok: boolean
  data?: unknown
  at: number
}

// Next.js dev는 라우트별로 모듈을 분리 번들링하므로, 모듈 레벨 배열은 라우트 간 공유되지 않는다.
// globalThis에 단일 저장소를 두어 같은 프로세스의 모든 사본이 같은 큐를 참조하게 한다(몽고 연결 캐시 패턴).
interface AgentStore {
  queue: AgentCommand[]
  results: Map<string, AgentResult>
  seq: number
}
const g = globalThis as unknown as { __selfieAgentQueue?: AgentStore }
const store: AgentStore = g.__selfieAgentQueue || (g.__selfieAgentQueue = { queue: [], results: new Map(), seq: 0 })
const { queue, results } = store

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function enqueueCommand(type: string, payload?: unknown): AgentCommand {
  const cmd: AgentCommand = { id: `${Date.now()}-${++store.seq}`, type, payload, enqueuedAt: Date.now() }
  queue.push(cmd)
  return cmd
}

/** long-poll: 명령이 생길 때까지 최대 timeoutMs 대기. 없으면 null. */
export async function waitForCommand(timeoutMs: number): Promise<AgentCommand | null> {
  const start = Date.now()
  for (;;) {
    const cmd = queue.shift()
    if (cmd) return cmd
    if (Date.now() - start >= timeoutMs) return null
    await sleep(250)
  }
}

export function putResult(id: string, ok: boolean, data?: unknown): void {
  results.set(id, { id, ok, data, at: Date.now() })
  // 메모리 누수 방지: 결과는 최근 200개만 유지
  if (results.size > 200) {
    const oldest = [...results.values()].sort((a, b) => a.at - b.at)[0]
    if (oldest) results.delete(oldest.id)
  }
}

export function getResult(id: string): AgentResult | null {
  return results.get(id) || null
}

export function queueDepth(): number {
  return queue.length
}
