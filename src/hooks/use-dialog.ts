"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let lockCount = 0;

function lockScroll() {
  lockCount += 1;
  if (lockCount === 1) document.body.classList.add("locked");
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.classList.remove("locked");
}

/**
 * Modal dialog behaviour: traps Tab focus inside `ref`, closes on Escape,
 * locks page scroll and restores focus to the previously focused element.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  options: { initialFocus?: RefObject<HTMLElement | null>; lock?: boolean; closeOnEscape?: boolean } = {},
) {
  const requestClose = useEffectEvent(() => onClose());
  const { initialFocus, lock = true, closeOnEscape = true } = options;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (lock) lockScroll();

    const node = ref.current;
    const focusFirst = () => {
      const target = initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
      target?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (lock) unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, ref, initialFocus, lock, closeOnEscape]);
}

/** Calls `onOutside` for pointer-downs outside every given element while `active`. */
export function useOutsideClick(refs: RefObject<HTMLElement | null>[], active: boolean, onOutside: () => void) {
  const notify = useEffectEvent(() => onOutside());
  useEffect(() => {
    if (!active) return;
    const handler = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.every((r) => !r.current?.contains(target))) notify();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [refs, active]);
}
