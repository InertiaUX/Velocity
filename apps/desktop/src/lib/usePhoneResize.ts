import { useCallback, useEffect, useRef, useState } from "react";
import { resizePhone } from "./plugins";
import {
  clampScale,
  designSize,
  percentLabel,
  placementForReason,
  scaleFromDiagonalDelta,
  shortSideForScale,
  type ResizeAnchor,
  type ResizeReason,
} from "./phoneGeometry";
import { useDeviceStore } from "../store/deviceStore";

export type PhoneResizeSession =
  | { kind: "idle" }
  | { kind: "dragging"; anchor: ResizeAnchor }
  | { kind: "committing" };

/** Visual scale is sync; window IPC is RAF-coalesced and serialized. */
export function usePhoneResize(opts: {
  hydrated: boolean;
  /** Ignore corner gestures during minimize/restore animation */
  animating?: boolean;
}) {
  const phoneScale = useDeviceStore((s) => s.phoneScale);
  const corner = useDeviceStore((s) => s.corner);
  const browserLandscape = useDeviceStore((s) => s.browserLandscape);
  const setPhoneScale = useDeviceStore((s) => s.setPhoneScale);

  const [visualScale, setVisualScale] = useState(phoneScale);
  const [session, setSession] = useState<PhoneResizeSession>({ kind: "idle" });
  const [hudVisible, setHudVisible] = useState(false);

  const liveScale = useRef(phoneScale);
  const resizingRef = useRef(false);
  const resizeChain = useRef(Promise.resolve() as Promise<void>);
  const prevCornerRef = useRef<string | null>(null);
  const prevLandscapeRef = useRef<boolean | null>(null);
  const prevScaleRef = useRef<number | null>(null);
  const hudHideTimer = useRef(0);

  const enqueue = useCallback((fn: () => Promise<unknown>) => {
    resizeChain.current = resizeChain.current
      .then(() => fn())
      .then(() => undefined)
      .catch((err) => {
        console.error("Velocity: resize apply failed", err);
      });
    return resizeChain.current;
  }, []);

  const applyWindow = useCallback(
    async (
      scale: number,
      reason: ResizeReason,
      anchor?: ResizeAnchor,
    ) => {
      const state = useDeviceStore.getState();
      const placement = placementForReason(reason);
      const result = await resizePhone(shortSideForScale(scale), state.corner, {
        landscape: state.browserLandscape,
        placement,
        anchor: placement === "anchor" ? anchor : undefined,
        snapToCorner: placement === "snap",
      });
      if (
        result?.appliedScale != null &&
        Math.abs(result.appliedScale - scale) > 0.01
      ) {
        // Work-area clamp may reduce scale - keep visual + store honest.
        liveScale.current = result.appliedScale;
        setVisualScale(result.appliedScale);
        if (reason !== "gesture") {
          setPhoneScale(result.appliedScale);
        }
      }
      return result;
    },
    [setPhoneScale],
  );

  const setScale = useCallback(
    (next: number, reason: ResizeReason, anchor?: ResizeAnchor) => {
      const scale = clampScale(next);
      liveScale.current = scale;
      setVisualScale(scale);

      if (reason === "gesture") {
        setHudVisible(true);
        if (hudHideTimer.current) window.clearTimeout(hudHideTimer.current);
      }

      if (reason === "slider") {
        setPhoneScale(scale);
        void enqueue(() => applyWindow(scale, "slider"));
        return;
      }

      if (reason === "gesture") {
        // Live drag - window only; store commits on endGesture.
        return;
      }

      setPhoneScale(scale);
      void enqueue(() => applyWindow(scale, reason, anchor));
    },
    [applyWindow, enqueue, setPhoneScale],
  );

  // Hydrate / corner / landscape / external store scale (slider from Settings).
  useEffect(() => {
    if (!opts.hydrated) return;
    if (resizingRef.current) return;

    const first = prevCornerRef.current === null;
    const cornerChanged = !first && prevCornerRef.current !== corner;
    const landscapeChanged = !first && prevLandscapeRef.current !== browserLandscape;
    const scaleChanged =
      prevScaleRef.current !== null &&
      Math.abs(prevScaleRef.current - phoneScale) > 0.0005;

    prevCornerRef.current = corner;
    prevLandscapeRef.current = browserLandscape;

    if (first) {
      liveScale.current = phoneScale;
      setVisualScale(phoneScale);
      prevScaleRef.current = phoneScale;
      void enqueue(() => applyWindow(phoneScale, "hydrate"));
      return;
    }

    if (cornerChanged) {
      prevScaleRef.current = phoneScale;
      void enqueue(() => applyWindow(phoneScale, "corner"));
      return;
    }

    if (landscapeChanged) {
      prevScaleRef.current = phoneScale;
      void enqueue(() => applyWindow(phoneScale, "landscape"));
      return;
    }

    if (scaleChanged) {
      // Settings slider (or other store write) while idle.
      liveScale.current = phoneScale;
      setVisualScale(phoneScale);
      prevScaleRef.current = phoneScale;
      void enqueue(() => applyWindow(phoneScale, "slider"));
    }
  }, [
    opts.hydrated,
    phoneScale,
    corner,
    browserLandscape,
    applyWindow,
    enqueue,
  ]);

  const beginGesture = useCallback(
    (e: React.PointerEvent, anchor: ResizeAnchor) => {
      if (opts.animating) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const diagonal = anchor === "nw" || anchor === "se" ? "nwse" : "nesw";
      document.body.classList.add(`velocity-resize-${diagonal}`);
      resizingRef.current = true;
      setSession({ kind: "dragging", anchor });
      setHudVisible(true);

      const startX = e.screenX;
      const startY = e.screenY;
      const startScale = liveScale.current;
      let raf = 0;
      let pending: number | null = null;
      let lastSent = startScale;
      let ended = false;

      const flush = (scale: number) => {
        liveScale.current = scale;
        setVisualScale(scale);
        void enqueue(() => applyWindow(scale, "gesture", anchor));
      };

      const apply = (scale: number) => {
        if (ended) return;
        const next = clampScale(scale);
        if (Math.abs(next - lastSent) < 0.003) return;
        pending = next;
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          if (ended || pending === null) return;
          const value = pending;
          pending = null;
          lastSent = value;
          flush(value);
        });
      };

      const onMove = (ev: PointerEvent) => {
        if (ended) return;
        const dx = ev.screenX - startX;
        const dy = ev.screenY - startY;
        apply(scaleFromDiagonalDelta(startScale, dx, dy, anchor));
      };

      const end = (ev: PointerEvent) => {
        if (ended) return;
        ended = true;
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", end);
        target.removeEventListener("pointercancel", end);
        if (raf) window.cancelAnimationFrame(raf);
        if (pending != null) {
          liveScale.current = pending;
          pending = null;
        }
        const scale = clampScale(liveScale.current);
        liveScale.current = scale;
        setVisualScale(scale);
        setSession({ kind: "committing" });

        void enqueue(async () => {
          await applyWindow(scale, "gesture", anchor);
          const committed = clampScale(liveScale.current);
          liveScale.current = committed;
          setVisualScale(committed);
          prevScaleRef.current = committed;
          setPhoneScale(committed);
          resizingRef.current = false;
          setSession({ kind: "idle" });
          document.body.classList.remove("velocity-resize-nwse", "velocity-resize-nesw");
          if (hudHideTimer.current) window.clearTimeout(hudHideTimer.current);
          hudHideTimer.current = window.setTimeout(() => setHudVisible(false), 600);
        });
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", end);
      target.addEventListener("pointercancel", end);
    },
    [applyWindow, enqueue, opts.animating, setPhoneScale],
  );

  useEffect(() => {
    return () => {
      if (hudHideTimer.current) window.clearTimeout(hudHideTimer.current);
    };
  }, []);

  const design = designSize(browserLandscape);
  const resizing = session.kind !== "idle";
  const hudText = percentLabel(visualScale);

  return {
    visualScale,
    designW: design.w,
    designH: design.h,
    resizing,
    session,
    hudVisible,
    hudText,
    beginGesture,
    setScale,
  };
}
