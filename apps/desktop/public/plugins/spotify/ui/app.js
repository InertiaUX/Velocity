const STORAGE_KEY = "velocity.spotify.v1";
const REDIRECT = "http://127.0.0.1:18766/callback";
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

const els = {
  connectCard: document.getElementById("connect-card"),
  playerCard: document.getElementById("player-card"),
  clientId: document.getElementById("client-id"),
  connect: document.getElementById("connect"),
  status: document.getElementById("status"),
  art: document.getElementById("art"),
  track: document.getElementById("track"),
  artist: document.getElementById("artist"),
  prev: document.getElementById("prev"),
  toggle: document.getElementById("toggle"),
  next: document.getElementById("next"),
  volume: document.getElementById("volume"),
  disconnect: document.getElementById("disconnect"),
  playerStatus: document.getElementById("player-status"),
};

let state = loadState();
let playing = false;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

async function hostRequest(method, params) {
  if (window.VelocityPlugin?.request) {
    return window.VelocityPlugin.request(method, params);
  }
  throw new Error("Velocity host bridge unavailable");
}

async function connect() {
  const clientId = els.clientId.value.trim();
  if (!clientId) {
    els.status.textContent = "Enter your Spotify Client ID.";
    return;
  }
  els.status.textContent = "Opening Spotify login…";
  const { verifier, challenge } = await pkce();
  const oauthState = b64url(crypto.getRandomValues(new Uint8Array(16)));
  state = { ...state, clientId, verifier, oauthState };
  saveState();

  const port = await hostRequest("spotify:oauthStart", { state: oauthState });
  const redirect = `http://127.0.0.1:${port}/callback`;
  const url =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirect,
      scope: SCOPES,
      state: oauthState,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
  await hostRequest("spotify:openUrl", { url });

  els.status.textContent = "Waiting for authorization…";
  const result = await pollOAuth();
  if (!result?.code) {
    els.status.textContent = result?.error || "Authorization failed.";
    return;
  }
  await exchangeToken(result.code, redirect);
  els.status.textContent = "Connected.";
  showPlayer();
  refreshPlayback();
}

async function pollOAuth() {
  for (let i = 0; i < 90; i++) {
    const result = await hostRequest("spotify:oauthPoll", {});
    if (result) return result;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { error: "Timed out waiting for login." };
}

async function exchangeToken(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: state.clientId,
    code_verifier: state.verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Token exchange failed");
  const json = await res.json();
  state.accessToken = json.access_token;
  state.refreshToken = json.refresh_token;
  state.expiresAt = Date.now() + json.expires_in * 1000;
  saveState();
}

async function ensureToken() {
  if (!state.accessToken) throw new Error("Not connected");
  if (Date.now() < (state.expiresAt || 0) - 15_000) return state.accessToken;
  if (!state.refreshToken) throw new Error("Session expired");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: state.refreshToken,
    client_id: state.clientId,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Refresh failed");
  const json = await res.json();
  state.accessToken = json.access_token;
  if (json.refresh_token) state.refreshToken = json.refresh_token;
  state.expiresAt = Date.now() + json.expires_in * 1000;
  saveState();
  return state.accessToken;
}

async function spotify(path, options = {}) {
  const token = await ensureToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return null;
}

async function refreshPlayback() {
  try {
    const data = await spotify("/me/player");
    if (!data) {
      els.track.textContent = "No active device";
      els.artist.textContent = "Open Spotify on a device, then try again.";
      els.playerStatus.textContent = "";
      return;
    }
    playing = !!data.is_playing;
    els.toggle.textContent = playing ? "Pause" : "Play";
    const item = data.item;
    if (item) {
      els.track.textContent = item.name;
      els.artist.textContent = (item.artists || []).map((a) => a.name).join(", ");
      const img = item.album?.images?.[0]?.url;
      els.art.innerHTML = img ? `<img src="${img}" alt="" />` : "♪";
    }
    if (typeof data.device?.volume_percent === "number") {
      els.volume.value = String(data.device.volume_percent);
    }
    els.playerStatus.textContent = "";
  } catch (e) {
    els.playerStatus.textContent = e.message || String(e);
  }
}

function showPlayer() {
  els.connectCard.hidden = true;
  els.playerCard.hidden = false;
}

function showConnect() {
  els.connectCard.hidden = false;
  els.playerCard.hidden = true;
  if (state.clientId) els.clientId.value = state.clientId;
}

els.connect.addEventListener("click", () => connect().catch((e) => {
  els.status.textContent = e.message || String(e);
}));
els.prev.addEventListener("click", () =>
  spotify("/me/player/previous", { method: "POST" }).then(refreshPlayback).catch((e) => {
    els.playerStatus.textContent = e.message;
  }),
);
els.next.addEventListener("click", () =>
  spotify("/me/player/next", { method: "POST" }).then(refreshPlayback).catch((e) => {
    els.playerStatus.textContent = e.message;
  }),
);
els.toggle.addEventListener("click", () =>
  spotify(playing ? "/me/player/pause" : "/me/player/play", { method: "PUT" })
    .then(refreshPlayback)
    .catch((e) => {
      els.playerStatus.textContent = e.message;
    }),
);
els.volume.addEventListener("change", () =>
  spotify(`/me/player/volume?volume_percent=${els.volume.value}`, { method: "PUT" }).catch((e) => {
    els.playerStatus.textContent = e.message;
  }),
);
els.disconnect.addEventListener("click", () => {
  state = { clientId: state.clientId };
  saveState();
  showConnect();
});

if (window.VelocityPlugin) window.VelocityPlugin.ready();

if (state.accessToken) {
  showPlayer();
  refreshPlayback();
  setInterval(refreshPlayback, 8000);
} else {
  showConnect();
}
