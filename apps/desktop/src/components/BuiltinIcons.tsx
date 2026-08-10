
type IconProps = { className?: string };

export function SettingsGlyph({ className }: IconProps) {
  // Dense 8-tooth gear with rim + hub (readable at icon size)
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14.05 1.75h3.9l.42 2.85c.85.22 1.65.57 2.38 1.03l2.55-1.42 2.76 2.76-1.42 2.55c.46.73.81 1.53 1.03 2.38l2.85.42v3.9l-2.85.42c-.22.85-.57 1.65-1.03 2.38l1.42 2.55-2.76 2.76-2.55-1.42a9.7 9.7 0 0 1-2.38 1.03l-.42 2.85h-3.9l-.42-2.85a9.7 9.7 0 0 1-2.38-1.03l-2.55 1.42-2.76-2.76 1.42-2.55A9.7 9.7 0 0 1 4.4 18.1L1.55 17.68v-3.9L4.4 13.36c.22-.85.57-1.65 1.03-2.38L4.01 8.43l2.76-2.76 2.55 1.42c.73-.46 1.53-.81 2.38-1.03l.42-2.85ZM16 11.15a4.85 4.85 0 1 0 0 9.7 4.85 4.85 0 0 0 0-9.7Zm0 2.55a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z"
      />
    </svg>
  );
}

export function BrowserGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 12h17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PluginsGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M8.5 3.75a.75.75 0 0 0-1.5 0V5.5H5.25A1.75 1.75 0 0 0 3.5 7.25v2H5a.75.75 0 0 1 0 1.5H3.5v2A1.75 1.75 0 0 0 5.25 14.5H7v1.75a.75.75 0 0 0 1.5 0V14.5h2a.75.75 0 0 0 0-1.5H8.5v-2h2a.75.75 0 0 0 0-1.5h-2v-2h2A.75.75 0 0 0 10.5 5.5H8.5V3.75Z" />
      <path
        d="M14 9.25A2.25 2.25 0 0 1 16.25 7H17.5V5.75a.75.75 0 0 1 1.5 0V7h1.25A2.25 2.25 0 0 1 22.5 9.25v1.25H21a.75.75 0 0 0 0 1.5h1.5v1.25A2.25 2.25 0 0 1 20.25 15.5H19v1.25a.75.75 0 0 1-1.5 0V15.5h-1.25A2.25 2.25 0 0 1 14 13.25v-1.25h1.5a.75.75 0 0 0 0-1.5H14V9.25Z"
        opacity="0.9"
      />
    </svg>
  );
}

export function SpotifyGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path
        fill="#fff"
        d="M16.9 16.3a.7.7 0 0 1-.96.24c-2.63-1.61-5.94-1.97-9.84-1.08a.7.7 0 1 1-.31-1.37c4.26-.97 7.9-.56 10.87 1.25a.7.7 0 0 1 .24.96Zm1.28-2.72a.88.88 0 0 1-1.2.3c-3.01-1.85-7.6-2.39-11.16-1.3a.88.88 0 1 1-.5-1.68c4.02-1.2 9.1-.6 12.56 1.52a.88.88 0 0 1 .3 1.16Zm.1-2.84c-3.6-2.14-9.55-2.34-12.99-1.29a1.05 1.05 0 1 1-.61-2.01c3.95-1.2 10.5-.97 14.63 1.49a1.05 1.05 0 1 1-1.03 1.81Z"
      />
    </svg>
  );
}

export function YouTubeGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18.1 5 12 5 12 5s-6.1 0-7.7.3A2.7 2.7 0 0 0 2.4 7.2 28.4 28.4 0 0 0 2 12a28.4 28.4 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C5.9 19 12 19 12 19s6.1 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28.4 28.4 0 0 0 22 12a28.4 28.4 0 0 0-.4-4.8ZM10.2 15.1V8.9L15.5 12l-5.3 3.1Z" />
    </svg>
  );
}

export function AddAppGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M17 14v6M14 17h6" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

export function WidgetsGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="3.5" y="3.5" width="8" height="8" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3.5" y="13.5" width="8" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function AddPageGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="4" y="3.5" width="11" height="17" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 8h5M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="17" r="3.25" fill="currentColor" />
      <path d="M18 15.5v3M16.5 17h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function DeletePageGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M9 4.5h6M5.5 7h13M8.5 7l.7 11.2a1.5 1.5 0 0 0 1.5 1.4h2.6a1.5 1.5 0 0 0 1.5-1.4L15.5 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type BuiltinGlyphKind =
  | "settings"
  | "browser"
  | "plugins"
  | "spotify"
  | "youtube";

export function builtinGlyphKind(tile: {
  id: string;
  icon: string;
  pluginId?: string;
  url?: string;
}): BuiltinGlyphKind | null {
  if (tile.id === "settings" || tile.icon === "settings") return "settings";
  if (tile.id === "browser" || tile.icon === "browser") return "browser";
  if (tile.id === "plugins" || tile.icon === "plugins") return "plugins";
  if (tile.id === "spotify" || tile.pluginId === "com.velocity.spotify" || tile.icon === "spotify")
    return "spotify";
  if (tile.id === "bookmark-youtube" || tile.url === "about:youtube" || tile.icon === "youtube")
    return "youtube";
  return null;
}

export function BuiltinGlyph({
  kind,
  className,
}: {
  kind: BuiltinGlyphKind;
  className?: string;
}) {
  switch (kind) {
    case "settings":
      return <SettingsGlyph className={className} />;
    case "browser":
      return <BrowserGlyph className={className} />;
    case "plugins":
      return <PluginsGlyph className={className} />;
    case "spotify":
      return <SpotifyGlyph className={className} />;
    case "youtube":
      return <YouTubeGlyph className={className} />;
  }
}
