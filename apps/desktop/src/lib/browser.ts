export type SearchEngineId = "google" | "brave" | "duckduckgo" | "bing";

export const SEARCH_ENGINES: {
  id: SearchEngineId;
  name: string;
  homeUrl: string;
  searchUrl: (query: string) => string;
}[] = [
  {
    id: "google",
    name: "Google",
    homeUrl: "https://www.google.com",
    searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "brave",
    name: "Brave",
    homeUrl: "https://search.brave.com",
    searchUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    homeUrl: "https://duckduckgo.com",
    searchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "bing",
    name: "Bing",
    homeUrl: "https://www.bing.com",
    searchUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
];

export const DEFAULT_SEARCH_ENGINE: SearchEngineId = "google";

export function getSearchEngine(id: SearchEngineId | string | undefined) {
  return SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0]!;
}

export function buildSearchUrl(query: string, engineId?: SearchEngineId | string) {
  return getSearchEngine(engineId).searchUrl(query.trim());
}

export function browserQuickLinks(engineId?: SearchEngineId | string) {
  const engine = getSearchEngine(engineId);
  return [
    {
      id: "youtube",
      title: "YouTube",
      url: "about:youtube",
      icon: "▶",
      accent: "#FF0033",
    },
    {
      id: "search",
      title: engine.name,
      url: engine.homeUrl,
      icon: engine.id === "brave" ? "🦁" : engine.id === "duckduckgo" ? "🦆" : engine.id === "bing" ? "b" : "G",
      accent:
        engine.id === "brave"
          ? "#FB542B"
          : engine.id === "duckduckgo"
            ? "#DE5833"
            : engine.id === "bing"
              ? "#008373"
              : "#4285F4",
    },
    {
      id: "wikipedia",
      title: "Wikipedia",
      url: "https://en.m.wikipedia.org",
      icon: "W",
      accent: "#111111",
    },
    {
      id: "reddit",
      title: "Reddit",
      url: "https://www.reddit.com",
      icon: "◉",
      accent: "#FF4500",
    },
  ] as const;
}

export function isSearchQuery(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  if (raw === "about:home" || raw === "about:youtube" || raw.startsWith("about:")) return false;
  return !looksLikeUrl(raw);
}

export function normalizeUrl(
  input: string,
  engineId: SearchEngineId | string = DEFAULT_SEARCH_ENGINE,
): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw === "about:home" || raw === "about:youtube") return raw;
  if (raw.startsWith("about:")) return raw;
  if (isSearchQuery(raw)) {
    return buildSearchUrl(raw, engineId);
  }
  try {
    const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function looksLikeUrl(s: string): boolean {
  if (/\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(s)) return true;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?([/:?#].*)?$/i.test(s)) return true;
  return false;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        return parts[1] || null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  if (extractYouTubeId(url)) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}

/** Shorts stay portrait; watch/live benefit from landscape. */
export function isYouTubeShortsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("youtube") && host !== "youtu.be") return false;
    return u.pathname.split("/").filter(Boolean)[0] === "shorts";
  } catch {
    return false;
  }
}

/** Mobile hosts + YouTube on m.youtube.com (iframe embeds hit Error 153 under Tauri). */
export function preferMobileUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "wikipedia.org") {
      u.hostname = "en.m.wikipedia.org";
      return u.toString();
    }
    if (host.endsWith(".wikipedia.org") && !host.includes(".m.")) {
      const lang = host.split(".")[0] || "en";
      u.hostname = `${lang}.m.wikipedia.org`;
      return u.toString();
    }
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (!id) return url;
      return `https://m.youtube.com/watch?v=${encodeURIComponent(id)}${u.search}`;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      u.hostname = "m.youtube.com";
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID → /watch?v=ID for the mobile player
      if (parts[0] === "embed" && parts[1]) {
        u.pathname = "/watch";
        u.searchParams.set("v", parts[1]);
      }
      return u.toString();
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function suggestTitleForUrl(url: string): string {
  const yt = extractYouTubeId(url);
  if (yt) return "YouTube";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("youtube")) return "YouTube";
    if (host.includes("google")) return "Google";
    if (host.includes("brave")) return "Brave";
    return host.split(".")[0]?.replace(/^\w/, (c) => c.toUpperCase()) || host;
  } catch {
    return "Bookmark";
  }
}

export function iconForUrl(url: string): string {
  const yt = extractYouTubeId(url);
  if (yt || /youtube\.com|youtu\.be/i.test(url)) return "▶";
  if (/google\./i.test(url)) return "G";
  if (/brave\./i.test(url)) return "🦁";
  if (/wikipedia\.org/i.test(url)) return "W";
  if (/reddit\.com/i.test(url)) return "◉";
  return "◎";
}

export function accentForUrl(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return "#FF0033";
  if (/brave\./i.test(url)) return "#FB542B";
  if (/google\./i.test(url)) return "#4285F4";
  if (/wikipedia\.org/i.test(url)) return "#111111";
  if (/reddit\.com/i.test(url)) return "#FF4500";
  return "#7EB6FF";
}
