import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  browserQuickLinks,
  buildSearchUrl,
  extractYouTubeId,
  getSearchEngine,
  isSearchQuery,
  isYouTubeShortsUrl,
  isYouTubeUrl,
  normalizeUrl,
  preferMobileUrl,
} from "../../lib/browser";
import { applyFaviconToTile } from "../../lib/favicons";
import {
  boundsFromElement,
  browserHide,
  browserOpenPage,
  browserReload,
  browserSetBounds,
} from "../../lib/mobileBrowser";
import { useDeviceStore } from "../../store/deviceStore";
import { AppNav } from "./SettingsApp";
import "./AppScreens.css";
import "./BrowserApp.css";

export function BrowserApp() {
  const accent = useDeviceStore((s) => s.accent);
  const openApp = useDeviceStore((s) => s.openApp);
  const browserUrl = useDeviceStore((s) => s.browserUrl) || "about:home";
  const setBrowserUrl = useDeviceStore((s) => s.setBrowserUrl);
  const browserLandscape = useDeviceStore((s) => s.browserLandscape);
  const setBrowserLandscape = useDeviceStore((s) => s.setBrowserLandscape);
  const searchEngine = useDeviceStore((s) => s.searchEngine);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const addBookmark = useDeviceStore((s) => s.addBookmark);
  const engine = getSearchEngine(searchEngine);
  const quickLinks = useMemo(() => browserQuickLinks(searchEngine), [searchEngine]);

  const [address, setAddress] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const skipStoreSync = useRef(false);
  const bootstrapped = useRef(false);

  const current = histIndex >= 0 ? history[histIndex]! : "about:home";
  const isHome = current === "about:home";
  const isYouTubeHub = current === "about:youtube";
  const isHttp = current.startsWith("http://") || current.startsWith("https://");
  const onYouTube = isHttp && isYouTubeUrl(current);
  const onShorts = onYouTube && isYouTubeShortsUrl(current);
  const canLandscape = onYouTube && !onShorts;

  const bookmarks = homeTiles.filter((t) => t.kind === "bookmark" && t.url);

  const openInSystemBrowser = (url: string) => {
    openUrl(url).catch(() => undefined);
  };

  const pushHistory = (next: string, opts?: { replace?: boolean }) => {
    if (opts?.replace || histIndex < 0) {
      setHistory([next]);
      setHistIndex(0);
      return;
    }
    if (history[histIndex] === next) return;
    const stack = history.slice(0, histIndex + 1);
    stack.push(next);
    setHistory(stack);
    setHistIndex(stack.length - 1);
  };

  const navigate = (input: string, opts?: { replace?: boolean }) => {
    const trimmed = input.trim();
    let next: string | null;
    if (trimmed === "" || trimmed === "about:home") {
      next = "about:home";
    } else if (trimmed === "about:youtube") {
      next = "about:youtube";
    } else if (isSearchQuery(trimmed)) {
      next = preferMobileUrl(buildSearchUrl(trimmed, searchEngine));
    } else {
      next = normalizeUrl(input, searchEngine);
      if (next && next.startsWith("http")) next = preferMobileUrl(next);
    }
    if (!next) return;
    pushHistory(next, opts);
  };

  // Bootstrap once from store
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const start = browserUrl || "about:home";
    skipStoreSync.current = true;
    const initial =
      start.startsWith("http") ? preferMobileUrl(start) : start || "about:home";
    setHistory([initial]);
    setHistIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another bookmark while browser is open
  useEffect(() => {
    if (!bootstrapped.current) return;
    if (!browserUrl || browserUrl === current) return;
    skipStoreSync.current = true;
    navigate(browserUrl, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserUrl]);

  useEffect(() => {
    setAddress(isHome || isYouTubeHub ? "" : current);
    setLoading(isHttp);
    if (skipStoreSync.current) {
      skipStoreSync.current = false;
      return;
    }
    if (browserUrl !== current) setBrowserUrl(current);
  }, [current, isHome, isYouTubeHub, isHttp, browserUrl, setBrowserUrl]);

  // Portrait for Shorts / non-YouTube; keep landscape only while watching long-form
  useEffect(() => {
    if (!canLandscape && browserLandscape) {
      setBrowserLandscape(false);
    }
  }, [canLandscape, browserLandscape, setBrowserLandscape]);

  // Drive the native mobile webview for all http(s) pages (incl. YouTube)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isHttp) {
        await browserHide().catch(() => undefined);
        return;
      }
      const bounds = boundsFromElement(stageRef.current);
      if (!bounds) return;
      setLoading(true);
      try {
        await browserOpenPage(current, bounds);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [current, isHttp]);

  // Keep webview bounds in sync with the stage (incl. landscape resize)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => {
      if (!isHttp) return;
      const bounds = boundsFromElement(el);
      if (bounds) void browserSetBounds(bounds).catch(() => undefined);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    // Landscape toggle changes window size after a beat
    const t = window.setTimeout(sync, 80);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [isHttp, browserLandscape]);

  const histRef = useRef({ history, histIndex });
  histRef.current = { history, histIndex };

  // Sync address bar when the user follows links inside the mobile webview
  useEffect(() => {
    let unNav: (() => void) | undefined;
    let unLoad: (() => void) | undefined;
    void listen<string>("browser://navigating", (e) => {
      const url = e.payload;
      if (!url?.startsWith("http")) return;
      setAddress(preferMobileUrl(url));
      setLoading(true);
    }).then((u) => {
      unNav = u;
    });
    void listen<string>("browser://page-loaded", (e) => {
      const url = e.payload;
      setLoading(false);
      if (!url?.startsWith("http")) return;
      const normalized = preferMobileUrl(url);
      const { history: h, histIndex: i } = histRef.current;
      if (i >= 0 && h[i] === normalized) {
        setAddress(normalized);
        return;
      }
      const stack = h.slice(0, Math.max(0, i) + 1);
      if (stack[stack.length - 1] !== normalized) stack.push(normalized);
      setHistory(stack);
      setHistIndex(stack.length - 1);
      setAddress(normalized);
    }).then((u) => {
      unLoad = u;
    });
    return () => {
      unNav?.();
      unLoad?.();
    };
  }, []);

  // Tear down webview + restore portrait when leaving Browser
  useEffect(() => {
    return () => {
      void browserHide().catch(() => undefined);
      useDeviceStore.getState().setBrowserLandscape(false);
    };
  }, []);

  const goBack = () => {
    if (histIndex > 0) setHistIndex((i) => i - 1);
    else if (histIndex === 0) {
      setHistory(["about:home"]);
      setHistIndex(0);
    }
  };

  const goForward = () => {
    if (histIndex >= 0 && histIndex < history.length - 1) setHistIndex((i) => i + 1);
  };

  const reload = () => {
    if (isHttp) {
      setLoading(true);
      void browserReload()
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  };

  const playYouTube = (input: string) => {
    const raw = input.trim();
    if (!raw) return;
    const asUrl = normalizeUrl(raw, searchEngine);
    if (asUrl && extractYouTubeId(asUrl)) {
      navigate(asUrl);
      return;
    }
    // Search → mobile YouTube results
    navigate(`https://m.youtube.com/results?search_query=${encodeURIComponent(raw)}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(address.trim() || "about:home");
  };

  const openExternal = () => {
    const url =
      isHome || isYouTubeHub
        ? isYouTubeHub
          ? "https://www.youtube.com"
          : engine.homeUrl
        : current.startsWith("about:")
          ? engine.homeUrl
          : current;
    openInSystemBrowser(url);
  };

  const saveBookmark = () => {
    if (isHome || isYouTubeHub) return;
    const tileId = addBookmark(current);
    if (tileId && current.startsWith("http")) {
      void applyFaviconToTile(tileId, current);
    }
  };

  return (
    <div className={`app-screen browser-app fade-up ${browserLandscape ? "is-landscape" : ""}`}>
      <AppNav title="Browser" onBack={() => openApp(null)} accent={accent} />

      <div className="browser-chrome">
        <div className="browser-nav-row">
          <button type="button" className="browser-icon-btn" disabled={histIndex <= 0} onClick={goBack} aria-label="Back">
            ‹
          </button>
          <button
            type="button"
            className="browser-icon-btn"
            disabled={histIndex < 0 || histIndex >= history.length - 1}
            onClick={goForward}
            aria-label="Forward"
          >
            ›
          </button>
          <button type="button" className="browser-icon-btn" onClick={() => navigate("about:home")} aria-label="Home">
            ⌂
          </button>
          <button
            type="button"
            className="browser-icon-btn"
            disabled={!isHttp}
            onClick={reload}
            aria-label="Reload"
          >
            ↻
          </button>
        </div>
        <form className="browser-address" onSubmit={onSubmit}>
          <input
            className="text-input"
            type="text"
            inputMode="url"
            enterKeyHint="go"
            placeholder={`Search ${engine.name} or enter URL`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address"
          />
        </form>
        <div className="browser-nav-row browser-actions">
          {canLandscape && (
            <button
              type="button"
              className={`browser-text-btn ${browserLandscape ? "is-active" : ""}`}
              onClick={() => setBrowserLandscape(!browserLandscape)}
              title={browserLandscape ? "Portrait" : "Landscape for video"}
            >
              {browserLandscape ? "Portrait" : "Landscape"}
            </button>
          )}
          <button
            type="button"
            className="browser-text-btn"
            disabled={isHome || isYouTubeHub || !isHttp}
            onClick={saveBookmark}
          >
            Bookmark
          </button>
          <button type="button" className="browser-text-btn" onClick={openExternal}>
            Open in Browser
          </button>
        </div>
      </div>

      <div className="browser-stage" ref={stageRef}>
        {isHome ? (
          <div className="browser-home">
            <p className="browser-home-title">Velocity Browser</p>
            <p className="browser-home-lede">
              Mobile sites load in-app. Search with {engine.name}, or open YouTube.
            </p>
            <form className="browser-home-search" onSubmit={onSubmit}>
              <input
                className="text-input"
                type="text"
                placeholder={`Search ${engine.name} or paste a link`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <button type="submit" className="block-btn" style={{ background: accent }}>
                Go
              </button>
            </form>

            <p className="browser-section-label">Quick links</p>
            <div className="browser-quick">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  className="browser-quick-item"
                  onClick={() => navigate(link.url)}
                >
                  <span className="browser-quick-icon" style={{ background: link.accent }}>
                    {link.icon}
                  </span>
                  <span>{link.title}</span>
                </button>
              ))}
            </div>

            {bookmarks.length > 0 && (
              <>
                <p className="browser-section-label">Home bookmarks</p>
                <div className="browser-bookmark-list">
                  {bookmarks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="browser-bookmark-row"
                      onClick={() => b.url && navigate(b.url)}
                    >
                      <span className="browser-quick-icon" style={{ background: b.accent || accent }}>
                        {b.icon}
                      </span>
                      <span className="meta">
                        <strong>{b.title}</strong>
                        <small>{b.url}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="browser-note">
              YouTube watch + Shorts use the mobile site player. Tap Landscape on watch pages for
              wider video.
            </p>
          </div>
        ) : isYouTubeHub ? (
          <div className="browser-home">
            <p className="browser-home-title">YouTube</p>
            <p className="browser-home-lede">
              Paste a watch or Shorts link, search, or browse the mobile site. Use Landscape for
              wider playback on regular videos.
            </p>
            <form
              className="browser-home-search"
              onSubmit={(e) => {
                e.preventDefault();
                playYouTube(ytQuery);
              }}
            >
              <input
                className="text-input"
                type="text"
                placeholder="youtube.com/watch?v=… · /shorts/… · or search"
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="block-btn" style={{ background: "#FF0033" }}>
                Play / Search
              </button>
            </form>
            <button
              type="button"
              className="browser-bookmark-row"
              onClick={() => navigate("https://m.youtube.com")}
            >
              <span className="browser-quick-icon" style={{ background: "#FF0033" }}>
                ▶
              </span>
              <span className="meta">
                <strong>Browse YouTube</strong>
                <small>Home, Shorts, subscriptions (mobile site)</small>
              </span>
            </button>
            <button
              type="button"
              className="browser-bookmark-row"
              onClick={() => navigate("https://m.youtube.com/shorts")}
            >
              <span className="browser-quick-icon" style={{ background: "#111" }}>
                ▮
              </span>
              <span className="meta">
                <strong>YouTube Shorts</strong>
                <small>Vertical feed (stays in portrait)</small>
              </span>
            </button>
          </div>
        ) : (
          <>
            {loading && <div className="browser-loading">Loading…</div>}
            {/* Native mobile webview is composited over this stage by Tauri */}
            <div className="browser-native-slot" aria-hidden />
          </>
        )}
      </div>
    </div>
  );
}
