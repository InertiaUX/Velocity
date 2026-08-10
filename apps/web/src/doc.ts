import "./styles.css";

// Soft parallax on atmosphere layers (same as homepage, lighter)
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
