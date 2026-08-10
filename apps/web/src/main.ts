import "./styles.css";

const RELEASE_VERSION = "0.1.1";
const RELEASE_TAG = `v${RELEASE_VERSION}`;
const RELEASES_PAGE = "https://github.com/InertiaUX/Velocity/releases";
const RELEASE_BASE = `https://github.com/InertiaUX/Velocity/releases/download/${RELEASE_TAG}`;

type DownloadTarget = {
  label: string;
  url: string;
  installHint: string;
};

function detectDownload(): DownloadTarget {
  const override = import.meta.env.VITE_DOWNLOAD_URL;
  if (override) {
    return {
      label: "Download",
      url: override,
      installHint: "Download the build for your platform from the link above.",
    };
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(ua) || platform.startsWith("Mac");
  const isWin = /Windows/i.test(ua) || platform.startsWith("Win");
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);

  if (isMac) {
    // Browsers rarely expose arm vs Intel; default to Apple Silicon and point Intel users to Releases.
    return {
      label: "Download for Mac",
      url: `${RELEASE_BASE}/Velocity-${RELEASE_VERSION}-macOS-arm64.zip`,
      installHint:
        "Download the Mac zip, unzip, and drag Velocity.app into Applications. On an Intel Mac, grab the x86_64 zip from Other platforms.",
    };
  }

  if (isWin) {
    return {
      label: "Download for Windows",
      url: `${RELEASE_BASE}/Velocity-${RELEASE_VERSION}-windows-x64-setup.exe`,
      installHint: "Run the Windows installer. WebView2 is required (Windows 10/11 usually include it).",
    };
  }

  if (isLinux) {
    return {
      label: "Download for Linux",
      url: `${RELEASE_BASE}/Velocity-${RELEASE_VERSION}-linux-x86_64.AppImage`,
      installHint:
        "Download the AppImage (or .deb from Other platforms), mark it executable, then run it. Needs WebKitGTK.",
    };
  }

  return {
    label: "View downloads",
    url: RELEASES_PAGE,
    installHint: "Pick the build for your platform from GitHub Releases.",
  };
}

const download = detectDownload();

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL || "https://github.com/sponsors/InertiaUX";

const cta = document.querySelector<HTMLAnchorElement>("#download-cta");
if (cta) {
  cta.href = download.url;
  cta.textContent = download.label;
  if (download.url.startsWith("http")) {
    cta.rel = "noopener noreferrer";
  }
}

const otherPlatforms = document.querySelector<HTMLAnchorElement>("#other-platforms");
if (otherPlatforms) {
  otherPlatforms.href = RELEASES_PAGE;
  otherPlatforms.rel = "noopener noreferrer";
}

const installHint = document.querySelector<HTMLElement>("#install-hint");
if (installHint) {
  installHint.textContent = download.installHint;
}

const supportCta = document.querySelector<HTMLAnchorElement>("#support-cta");
if (supportCta) {
  supportCta.href = SUPPORT_URL;
  if (SUPPORT_URL.startsWith("http")) {
    supportCta.rel = "noopener noreferrer";
  }
}

const phone = document.querySelector(".phone-rise");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
requestAnimationFrame(() => {
  phone?.classList.add("is-in");
});

if (!reduceMotion) {
  const layers = document.querySelectorAll<HTMLElement>("[data-parallax]");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      layers.forEach((el) => {
        const factor = Number(el.dataset.parallax) || 0.1;
        el.style.transform = `translate3d(0, ${y * factor}px, 0)`;
      });
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

const keys = document.querySelector<HTMLElement>("[data-keys]");
if (keys && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        keys.classList.add("is-press");
        window.setTimeout(() => keys.classList.remove("is-press"), 220);
        window.setTimeout(() => {
          keys.classList.add("is-press");
          window.setTimeout(() => keys.classList.remove("is-press"), 180);
        }, 420);
        io.disconnect();
      }
    },
    { threshold: 0.55 },
  );
  io.observe(keys);
}
