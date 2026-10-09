"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function useWorkflowMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

// 중첩된 클립 확인창이 닫혀도 아래 작업 화면의 스크롤 잠금은 유지한다.
const overlays: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalBodyStyle = "";
let pageScroll = 0;
let inertObserver: MutationObserver | null = null;
function updateInert() {
  const top = overlays.at(-1);
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = top ? child !== top && !child.contains(top) : originalInert.get(child)!;
  }
}

export function useWorkflowOverlay(active: boolean, host: HTMLElement | null, dialog: RefObject<HTMLElement>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active || !host || !dialog.current) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (overlays.length === 0) {
      pageScroll = window.scrollY;
      originalBodyStyle = document.body.style.cssText;
      Object.assign(document.body.style, { position: "fixed", top: `-${pageScroll}px`, width: "100%", overflow: "hidden" });
      inertObserver = new MutationObserver(updateInert);
      inertObserver.observe(document.body, { childList: true });
    }
    overlays.push(host);
    updateInert();
    dialog.current.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (overlays.at(-1) !== host) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], iframe, [tabindex="0"]') || [])
        .filter((element) => element.getClientRects().length && !element.closest('[inert], [hidden]'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialog.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      overlays.splice(overlays.indexOf(host), 1);
      updateInert();
      if (overlays.length === 0) {
        inertObserver?.disconnect();
        inertObserver = null;
        document.body.style.cssText = originalBodyStyle;
        window.scrollTo(0, pageScroll);
        for (const [element, inert] of originalInert) element.inert = inert;
        originalInert.clear();
      }
      const returnFocus = previousFocus?.isConnected ? previousFocus : previousFocus?.id ? document.getElementById(previousFocus.id) : null;
      if (returnFocus && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
    };
  }, [active, host, dialog]);
}

export function usePortalHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    setHost(element);
    return () => { element.remove(); };
  }, []);
  return host;
}

type Workspace = {
  mobile: boolean;
  active: boolean;
  scrollRef: RefObject<HTMLDivElement>;
  guard: React.MutableRefObject<(() => Promise<boolean>) | null>;
  footer: HTMLDivElement | null;
};
const WorkspaceContext = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceActions({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  const workspace = useWorkspace();
  if (workspace?.mobile) return hidden || !workspace.footer ? null : createPortal(children, workspace.footer);
  return <>{children}</>;
}

export function useMobileViewport() {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const update = () => setHeight(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => { window.visualViewport?.removeEventListener('resize', update); window.removeEventListener('resize', update); };
  }, []);
  return height;
}

export default function WorkflowWorkspace({ open, onClose, title, backLabel, children }: {
  open: boolean; onClose: () => void; title: string; backLabel: string; children: ReactNode;
}) {
  const mobile = useWorkflowMobile();
  const host = usePortalHost();
  const anchor = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const titleId = useId();
  const [leaving, setLeaving] = useState(false);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const viewportHeight = useMobileViewport();
  const close = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try { if (!guard.current || await guard.current()) onClose(); }
    finally { setLeaving(false); }
  }, [leaving, onClose]);
  // 포털 대상은 그대로 두고 호스트만 옮겨 반응형 전환에도 플레이어를 보존한다.
  useLayoutEffect(() => {
    if (!host) return;
    (mobile ? document.body : anchor.current)?.appendChild(host);
  }, [mobile, host]);
  useWorkflowOverlay(mobile && open, host, dialog, () => { void close(); });

  return <div ref={anchor}>
    {host && createPortal(
      <WorkspaceContext.Provider value={{ mobile, active: !mobile || open, scrollRef, guard, footer }}>
        <div ref={dialog} tabIndex={-1} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} aria-labelledby={mobile && open ? titleId : undefined}
          style={mobile && viewportHeight ? { height: viewportHeight } : undefined}
          className={mobile ? `${open ? "flex" : "hidden"} fixed inset-0 z-[60] h-screen supports-[height:100dvh]:h-[100dvh] flex-col bg-light-background dark:bg-dark-background outline-none` : "outline-none"}>
          {mobile && <header className="shrink-0 border-b border-light-primary/20 dark:border-dark-primary/20 px-3 pt-[env(safe-area-inset-top)]">
            <button type="button" onClick={() => { void close(); }} disabled={leaving} className="min-h-11 text-sm text-light-text dark:text-dark-text">← {backLabel}</button>
            <h2 id={titleId} className="pb-3 text-sm font-semibold text-light-text dark:text-dark-text break-words">{title}</h2>
          </header>}
          <div ref={scrollRef} className={mobile ? "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" : ""}>{children}</div>
          {mobile && <div ref={setFooter} className="shrink-0 border-t border-light-primary/20 dark:border-dark-primary/20 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] empty:hidden" />}
        </div>
      </WorkspaceContext.Provider>, host)}
  </div>;
}
