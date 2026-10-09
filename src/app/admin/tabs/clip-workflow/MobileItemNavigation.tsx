"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "./WorkflowWorkspace";
import { createPortal } from 'react-dom';
import type { ItemEditorHandle } from "./ItemEditor";

export function useItemNavigation(items: { id: string }[], selectedId: string | null, setSelectedId: (id: string) => void) {
  const workspace = useWorkspace();
  const mobile = workspace?.mobile ?? false;
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const editor = useRef<ItemEditorHandle>(null);
  const listScroll = useRef(0);
  const trigger = useRef<HTMLElement | null>(null);
  const index = items.findIndex((item) => item.id === selectedId);
  const scroll = useCallback((top: number) => {
    requestAnimationFrame(() => { workspace?.scrollRef.current?.scrollTo({ top }); });
  }, [workspace?.scrollRef]);
  const prepare = useCallback(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    return await editor.current?.prepareToLeave() ?? true;
  }, []);
  useEffect(() => {
    if (!workspace) return;
    workspace.guard.current = prepare;
    return () => { workspace.guard.current = null; };
  }, [workspace?.guard, prepare]);
  useEffect(() => { if (index < 0 && editing) { setEditing(false); scroll(listScroll.current); } }, [index, editing, scroll]);
  useEffect(() => {
    if (!mobile || !editing) return;
    const frame = requestAnimationFrame(() => workspace?.scrollRef.current?.querySelector<HTMLElement>('[data-editor-heading]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [mobile, editing, selectedId, workspace?.scrollRef]);
  const open = (id: string) => {
    trigger.current = document.activeElement as HTMLElement;
    if (mobile) {
      listScroll.current = workspace?.scrollRef.current?.scrollTop ?? 0;
      setEditing(true);
      scroll(0);
    }
    setSelectedId(id);
  };
  const back = async () => {
    if (moving) return;
    setMoving(true);
    try {
      if (!await prepare()) return;
      setEditing(false);
      scroll(listScroll.current);
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    } finally { setMoving(false); }
  };
  const move = async (delta: number) => {
    const next = items[index + delta];
    if (!next || moving) return;
    setMoving(true);
    try { if (await prepare()) { setSelectedId(next.id); scroll(0); } }
    finally { setMoving(false); }
  };
  return { mobile, editing, moving, editor, index, count: items.length, open, back, move,
    listClass: mobile && editing ? "hidden" : "",
    editorClass: mobile && !editing ? "hidden" : "",
    active: (workspace?.active ?? true) && (!mobile || editing),
  };
}

export default function MobileItemNavigation({ navigation, footer = false }: { navigation: ReturnType<typeof useItemNavigation>; footer?: boolean }) {
  const workspace = useWorkspace();
  if (!navigation.mobile || !navigation.editing) return null;
  const buttonClass = "min-h-11 rounded-lg border border-light-primary/20 dark:border-dark-primary/20 px-3 text-sm text-light-text dark:text-dark-text disabled:opacity-40";
  const content = footer ? <nav aria-label="타임라인 항목 이동" className="flex justify-between gap-3">
    <button type="button" className={buttonClass} disabled={navigation.moving || navigation.index <= 0} onClick={() => { void navigation.move(-1); }}>← 이전 항목</button>
    <button type="button" className={buttonClass} disabled={navigation.moving || navigation.index < 0 || navigation.index >= navigation.count - 1} onClick={() => { void navigation.move(1); }}>다음 항목 →</button>
  </nav> : <div className="flex items-center justify-between gap-3">
    <button type="button" className={buttonClass} disabled={navigation.moving} onClick={() => { void navigation.back(); }}>← 타임라인</button>
    <h3 tabIndex={-1} data-editor-heading className="text-sm tabular-nums text-light-text dark:text-dark-text outline-none">{navigation.index + 1} / {navigation.count}</h3>
  </div>;
  return footer && workspace?.footer ? createPortal(content, workspace.footer) : content;
}
