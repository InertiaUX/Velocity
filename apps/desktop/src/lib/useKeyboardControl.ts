import { useEffect } from "react";
import { HOME_COLS, HOME_SLOT_COUNT, useDeviceStore } from "../store/deviceStore";
import { isTypingTarget } from "./isTypingTarget";
import { launchTarget } from "./plugins";

function queryKbItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-kb-item]"));
}

function moveInGrid(index: number, key: string, count: number, cols: number): number {
  if (count <= 0) return 0;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rows = Math.ceil(count / cols);

  if (key === "ArrowRight") {
    if (col < cols - 1 && index + 1 < count) return index + 1;
    return index;
  }
  if (key === "ArrowLeft") {
    if (col > 0) return index - 1;
    return index;
  }
  if (key === "ArrowDown") {
    const next = index + cols;
    if (next < count) return next;
    if (row < rows - 1) return count - 1;
    return index;
  }
  if (key === "ArrowUp") {
    const next = index - cols;
    return next >= 0 ? next : index;
  }
  return index;
}

function moveInList(index: number, key: string, count: number): number {
  if (count <= 0) return 0;
  if (key === "ArrowDown" || key === "ArrowRight") return Math.min(count - 1, index + 1);
  if (key === "ArrowUp" || key === "ArrowLeft") return Math.max(0, index - 1);
  return index;
}

function activateItem(el: HTMLElement) {
  const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox) {
    checkbox.click();
    return;
  }
  if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") {
    el.click();
    return;
  }
  const button = el.querySelector<HTMLButtonElement>("button");
  if (button) {
    button.click();
    return;
  }
  const select = el.querySelector<HTMLSelectElement>("select");
  if (select) {
    select.focus();
    return;
  }
  el.click();
}

function scrollItemIntoView(el: HTMLElement) {
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function clearPaint() {
  queryKbItems().forEach((el) => {
    el.classList.remove("is-kb-selected");
    el.removeAttribute("aria-selected");
  });
}

export function useKeyboardControl(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("kb-nav");
      clearPaint();
      return;
    }
    document.documentElement.classList.add("kb-nav");

    const paint = (index: number, visible: boolean) => {
      if (!visible) {
        clearPaint();
        return;
      }
      const items = queryKbItems();
      items.forEach((el, i) => {
        const on = i === index;
        el.classList.toggle("is-kb-selected", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
      });
      const active = items[index];
      if (active) scrollItemIntoView(active);
    };

    const sync = () => {
      const state = useDeviceStore.getState();
      const items = queryKbItems();
      if (items.length === 0) return;
      const idx = Math.min(state.kbFocusIndex, items.length - 1);
      if (idx !== state.kbFocusIndex) state.setKbFocusIndex(idx);
      paint(idx, state.kbFocusVisible);
    };
    const raf = requestAnimationFrame(sync);
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    const root = document.querySelector(".phone-screen") ?? document.body;
    observer.observe(root, { childList: true, subtree: true });

    const onPointer = () => {
      const state = useDeviceStore.getState();
      if (!state.kbFocusVisible) return;
      state.setKbFocusVisible(false);
      clearPaint();
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const state = useDeviceStore.getState();
      if (!state.phoneVisible || !state.onboarded) return;

      const backKeys = e.key === "Escape" || e.key === "Backspace" || e.key === "Delete";
      const arrow =
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight";
      const activate = e.key === "Enter" || e.key === " ";

      if (!arrow && !activate && !backKeys) return;

      e.preventDefault();
      e.stopPropagation();

      // Esc / Delete dismisses home edit mode first
      if (backKeys && state.editingHome && !state.openAppId) {
        state.setEditingHome(false);
        return;
      }

      useDeviceStore.setState({ kbFocusVisible: true });

      if (state.openAppId) {
        if (backKeys) {
          state.openApp(null);
          return;
        }
        const items = queryKbItems();
        if (items.length === 0) return;
        let next = Math.min(state.kbFocusIndex, items.length - 1);

        if (arrow) {
          next = moveInList(next, e.key, items.length);
          useDeviceStore.setState({ kbFocusIndex: next, kbFocusVisible: true });
          paint(next, true);
          return;
        }
        if (activate) {
          activateItem(items[next]!);
        }
        return;
      }

      if (backKeys) return;

      // Home grid: kb index is a sparse slot (0 .. HOME_SLOT_COUNT-1) on the active page
      const pageId = state.activePageId;
      const pageTiles = state.homeTiles.filter(
        (t) => t.pageId === pageId && t.slot != null && t.slot >= 0,
      );
      const count = HOME_SLOT_COUNT;
      let next = Math.min(state.kbFocusIndex, count - 1);

      if (arrow) {
        next = moveInGrid(next, e.key, count, HOME_COLS);
        useDeviceStore.setState({ kbFocusIndex: next, kbFocusVisible: true });
        paint(next, true);
        return;
      }

      if (activate) {
        const items = queryKbItems();
        const el = items.find((n) => Number(n.dataset.kbIndex) === next) ?? items[next];
        if (state.editingHome) {
          if (el) activateItem(el);
          return;
        }
        const tile = pageTiles.find((t) => t.slot === next);
        if (!tile || tile.kind === "widget") return;
        if (tile.kind === "bookmark" && tile.url) {
          state.openBrowser(tile.url);
        } else if (tile.id === "browser") {
          state.openBrowser();
        } else if (tile.kind === "custom" && tile.launchTarget) {
          launchTarget(tile.launchTarget).catch(() => undefined);
        } else {
          state.openApp(tile.id);
        }
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("pointerdown", onPointer, { capture: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onPointer, { capture: true });
      document.documentElement.classList.remove("kb-nav");
      clearPaint();
    };
  }, [enabled]);
}
