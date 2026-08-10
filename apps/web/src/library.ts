import "./styles.css";
import "./doc.ts";

type RepoPlugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  permissions?: string[];
  provides?: string[];
  downloadUrl: string;
};

type RepoFeed = {
  name?: string;
  description?: string;
  updated?: string;
  plugins?: RepoPlugin[];
};

const REPO_URL = "/repo.json";

const listEl = document.querySelector<HTMLElement>("#library-list");
const statusEl = document.querySelector<HTMLElement>("#library-status");
const emptyEl = document.querySelector<HTMLElement>("#library-empty");
const queryEl = document.querySelector<HTMLInputElement>("#library-query");

let plugins: RepoPlugin[] = [];

function render(filter: string) {
  if (!listEl || !emptyEl || !statusEl) return;
  const q = filter.trim().toLowerCase();
  const filtered = plugins.filter((p) => {
    if (!q) return true;
    const hay = `${p.name} ${p.id} ${p.description ?? ""} ${(p.permissions ?? []).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });

  listEl.innerHTML = "";
  emptyEl.hidden = filtered.length > 0;
  listEl.hidden = filtered.length === 0;

  for (const p of filtered) {
    const article = document.createElement("article");
    article.className = "library-card";

    const icon = document.createElement("div");
    icon.className = "library-card-icon";
    if (p.icon) {
      const img = document.createElement("img");
      img.src = p.icon;
      img.alt = "";
      img.width = 40;
      img.height = 40;
      icon.appendChild(img);
    } else {
      icon.textContent = "◆";
    }

    const body = document.createElement("div");
    body.className = "library-card-body";

    const title = document.createElement("h2");
    title.textContent = p.name;

    const meta = document.createElement("p");
    meta.className = "library-card-meta";
    const bits = [`v${p.version}`, p.id];
    if (p.permissions?.length) bits.push(p.permissions.join(", "));
    meta.textContent = bits.join(" · ");

    const desc = document.createElement("p");
    desc.className = "library-card-desc";
    desc.textContent = p.description || "No description.";

    const actions = document.createElement("div");
    actions.className = "library-card-actions";

    const get = document.createElement("a");
    get.className = "cta";
    get.href = p.downloadUrl;
    get.textContent = "Download zip";
    get.rel = "noopener noreferrer";

    const tip = document.createElement("span");
    tip.className = "muted";
    tip.textContent = "Or install from Plugins → Browse library in the app";

    actions.append(get, tip);
    body.append(title, meta, desc, actions);
    article.append(icon, body);
    listEl.appendChild(article);
  }
}

async function load() {
  if (!statusEl) return;
  try {
    const res = await fetch(REPO_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feed = (await res.json()) as RepoFeed;
    plugins = Array.isArray(feed.plugins) ? feed.plugins : [];
    const name = feed.name || "Velocity Official";
    statusEl.textContent = `${plugins.length} plugin${plugins.length === 1 ? "" : "s"} · ${name}${
      feed.updated ? ` · updated ${feed.updated}` : ""
    }`;
    render(queryEl?.value ?? "");
  } catch (e) {
    statusEl.textContent = `Could not load catalog: ${e instanceof Error ? e.message : String(e)}`;
  }
}

queryEl?.addEventListener("input", () => render(queryEl.value));
void load();
