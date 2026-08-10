import { useEffect, useRef } from "react";
import { isTypingTarget } from "./isTypingTarget";

function queryItems(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".onboarding [data-kb-item]:not([disabled])"),
  );
}

function paint(index: number) {
  const items = queryItems();
  items.forEach((el, i) => {
    const on = i === index;
    el.classList.toggle("is-kb-selected", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  });
  items[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function activate(el: HTMLElement) {
  const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox) {
    checkbox.click();
    return;
  }
  const range = el.querySelector<HTMLInputElement>('input[type="range"]');
  if (range) {
    range.focus();
    return;
  }
  const select = el.querySelector<HTMLSelectElement>("select");
  if (select) {
    select.focus();
    return;
  }
  const text = el.querySelector<HTMLInputElement>(
    'input[type="text"], input:not([type]), input.hotkey-input',
  );
  if (text) {
    text.focus();
    text.select?.();
    return;
  }
  if (
    el.tagName === "BUTTON" ||
    el.getAttribute("role") === "button" ||
    el.getAttribute("role") === "radio"
  ) {
    el.click();
    return;
  }
  const button = el.querySelector<HTMLButtonElement>("button");
  if (button) {
    button.click();
    return;
  }
  el.click();
}

export function useOnboardingKeyboard(enabled: boolean, step: number) {
  const focusIndex = useRef(0);

  // Reset cursor to the primary action whenever the step changes
  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(() => {
      const items = queryItems();
      if (items.length === 0) return;
      const primary = items.findIndex((el) => el.hasAttribute("data-kb-primary"));
      focusIndex.current = primary >= 0 ? primary : 0;
      paint(focusIndex.current);
    });
    return () => cancelAnimationFrame(id);
  }, [enabled, step]);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("kb-nav");

    const sync = () => {
      const items = queryItems();
      if (items.length === 0) return;
      focusIndex.current = Math.min(focusIndex.current, items.length - 1);
      paint(focusIndex.current);
    };

    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    const root = document.querySelector(".onboarding");
    if (root) observer.observe(root, { childList: true, subtree: true });

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape" && e.target instanceof HTMLElement) {
          e.preventDefault();
          e.target.blur();
          paint(focusIndex.current);
        }
        return;
      }

      const arrow =
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight";
      const activateKey = e.key === "Enter" || e.key === " ";
      const back = e.key === "Escape" || e.key === "Backspace" || e.key === "Delete";

      if (!arrow && !activateKey && !back) return;

      e.preventDefault();
      e.stopPropagation();

      const items = queryItems();
      if (items.length === 0) return;

      if (focusIndex.current < 0 || focusIndex.current >= items.length) {
        const primary = items.findIndex((el) => el.hasAttribute("data-kb-primary"));
        focusIndex.current = primary >= 0 ? primary : 0;
      }

      if (back) {
        const backBtn = document.querySelector<HTMLButtonElement>(
          ".onboarding .ob-actions button:not(.primary)",
        );
        backBtn?.click();
        return;
      }

      let next = focusIndex.current;
      if (arrow) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          next = Math.min(items.length - 1, next + 1);
        } else {
          next = Math.max(0, next - 1);
        }
        focusIndex.current = next;
        paint(next);
        return;
      }

      if (activateKey) {
        const el = items[next];
        if (el) activate(el);
        requestAnimationFrame(() => paint(focusIndex.current));
      }
    };

    const onPointer = () => {
      queryItems().forEach((el) => {
        el.classList.remove("is-kb-selected");
        el.removeAttribute("aria-selected");
      });
      focusIndex.current = -1;
    };

    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("pointerdown", onPointer, { capture: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onPointer, { capture: true });
      document.documentElement.classList.remove("kb-nav");
      queryItems().forEach((el) => {
        el.classList.remove("is-kb-selected");
        el.removeAttribute("aria-selected");
      });
    };
  }, [enabled]);
}
