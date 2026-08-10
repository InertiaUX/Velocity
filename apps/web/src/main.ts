import "./styles.css";

const DOWNLOAD_URL =
  import.meta.env.VITE_DOWNLOAD_URL ||
  "https://github.com/InertiaUX/Velocity/releases/download/v0.1.1/Velocity-0.1.1-macOS-arm64.zip";

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL || "https://github.com/sponsors/InertiaUX";

const cta = document.querySelector<HTMLAnchorElement>("#download-cta");
if (cta) {
  cta.href = DOWNLOAD_URL;
  if (DOWNLOAD_URL.startsWith("http")) {
    cta.rel = "noopener noreferrer";
  }
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
