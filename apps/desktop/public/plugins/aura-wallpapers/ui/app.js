const PACK = [
  {
    id: "coral-dusk",
    name: "Coral Dusk",
    css: "linear-gradient(160deg, #2b1a24 0%, #c45c4a 45%, #f0c27b 100%)",
  },
  {
    id: "harbor",
    name: "Harbor",
    css: "linear-gradient(180deg, #0b1f2a 0%, #1f6f8b 55%, #7fd3c2 100%)",
  },
  {
    id: "volt-mist",
    name: "Volt Mist",
    css: "radial-gradient(circle at 30% 20%, rgba(240,213,106,0.55), transparent 45%), linear-gradient(165deg, #101820, #243b55)",
  },
];

const grid = document.getElementById("grid");
const status = document.getElementById("status");

PACK.forEach((item) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card";
  btn.innerHTML = `<div class="preview" style="background:${item.css}"></div>
    <div class="meta"><strong>${item.name}</strong><span>Apply wallpaper</span></div>`;
  btn.addEventListener("click", async () => {
    status.textContent = "Applying…";
    try {
      await window.VelocityPlugin.request("wallpaper:apply", {
        pluginId: "com.velocity.aura-wallpapers",
        id: item.id,
        css: item.css,
      });
      status.textContent = `${item.name} applied.`;
    } catch (e) {
      status.textContent = e.message || String(e);
    }
  });
  grid.appendChild(btn);
});

if (window.VelocityPlugin) window.VelocityPlugin.ready();
