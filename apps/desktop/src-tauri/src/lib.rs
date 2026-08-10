use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    WebviewUrl, WebviewWindow,
};
use tauri::webview::WebviewBuilder;
use url::Url;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const MARGIN: i32 = 24;
/// Keep in sync with apps/desktop/src/lib/phoneGeometry.ts (DESIGN_SHORT / DESIGN_LONG).
const BASE_W: f64 = 360.0;
const BASE_H: f64 = 740.0;
const ASPECT: f64 = BASE_H / BASE_W;
/// Soft UI scale range (short side = BASE_W * scale). Work-area may clamp further.
const SCALE_MIN: f64 = 0.78;
const SCALE_MAX: f64 = 1.35;
const OAUTH_PORT: u16 = 18766;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginWallpaperOffer {
    pub id: String,
    pub name: String,
    pub css: Option<String>,
    pub image: Option<String>,
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    #[serde(default = "default_plugin_entry")]
    pub entry: String,
    pub permissions: Option<Vec<String>>,
    pub provides: Option<Vec<String>>,
    pub wallpapers: Option<Vec<PluginWallpaperOffer>>,
    pub path: Option<String>,
}

fn default_plugin_entry() -> String {
    "ui/index.html".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallPreview {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    pub provides: Vec<String>,
    pub already_installed: bool,
    pub installed_version: Option<String>,
    /// Absolute path the installer should pass to `install_plugin_from_path`
    /// (folder, zip, or velocity.plugin.json).
    pub source_path: String,
}

/// Resolve a user-picked path to a plugin root directory.
/// Returns (plugin_root, cleanup_temp_dir_if_any).
fn resolve_plugin_package(source_path: &PathBuf) -> Result<(PathBuf, Option<PathBuf>), String> {
    if !source_path.exists() {
        return Err(format!("Path not found: {}", source_path.display()));
    }

    if source_path.is_file() {
        let name = source_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if name == "velocity.plugin.json" {
            let parent = source_path
                .parent()
                .ok_or("Invalid plugin path")?
                .to_path_buf();
            if read_manifest(&parent).is_none() {
                return Err("Invalid velocity.plugin.json".into());
            }
            return Ok((parent, None));
        }
        if name.ends_with(".zip") {
            let temp = std::env::temp_dir().join(format!(
                "velocity-plugin-{}",
                uuid::Uuid::new_v4()
            ));
            extract_plugin_zip(source_path, &temp)?;
            let root = find_plugin_root(&temp)
                .ok_or_else(|| {
                    let _ = std::fs::remove_dir_all(&temp);
                    "Zip does not contain velocity.plugin.json".to_string()
                })?;
            return Ok((root, Some(temp)));
        }
        return Err("Choose a plugin folder, .zip, or velocity.plugin.json".into());
    }

    // Directory: manifest here, or a single nested folder with a manifest.
    if read_manifest(source_path).is_some() {
        return Ok((source_path.clone(), None));
    }
    if let Ok(entries) = std::fs::read_dir(source_path) {
        let dirs: Vec<PathBuf> = entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        if dirs.len() == 1 {
            if read_manifest(&dirs[0]).is_some() {
                return Ok((dirs[0].clone(), None));
            }
        }
        for dir in &dirs {
            if read_manifest(dir).is_some() {
                return Ok((dir.clone(), None));
            }
        }
    }
    Err("Folder is missing velocity.plugin.json".into())
}

fn find_plugin_root(root: &PathBuf) -> Option<PathBuf> {
    if read_manifest(root).is_some() {
        return Some(root.clone());
    }
    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_plugin_root(&path) {
                return Some(found);
            }
        }
    }
    None
}

fn extract_plugin_zip(zip_path: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let file = std::fs::File::open(zip_path).map_err(|e| format!("Cannot open zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip: {e}"))?;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {e}"))?;
        let name = entry
            .enclosed_name()
            .ok_or_else(|| "Zip entry has an unsafe path".to_string())?
            .to_path_buf();
        let out = dest.join(&name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut outfile = std::fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn preview_from_manifest(
    app: &AppHandle,
    manifest: &PluginManifest,
    source_path: &PathBuf,
) -> PluginInstallPreview {
    let installed = list_plugins(app.clone())
        .ok()
        .and_then(|plugins| plugins.into_iter().find(|p| p.id == manifest.id));
    PluginInstallPreview {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        permissions: manifest.permissions.clone().unwrap_or_default(),
        provides: manifest.provides.clone().unwrap_or_default(),
        already_installed: installed.is_some(),
        installed_version: installed.map(|p| p.version),
        source_path: source_path.to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn inspect_plugin_package(
    app: AppHandle,
    source_path: String,
) -> Result<PluginInstallPreview, String> {
    let path = PathBuf::from(&source_path);
    let (root, temp) = resolve_plugin_package(&path)?;
    let manifest = read_manifest(&root).ok_or("Invalid plugin: missing velocity.plugin.json")?;
    // Preview uses the original user path so install can re-resolve (and re-extract zip).
    let preview = preview_from_manifest(&app, &manifest, &path);
    if let Some(temp) = temp {
        let _ = std::fs::remove_dir_all(temp);
    }
    Ok(preview)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthResult {
    pub code: Option<String>,
    pub error: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedApp {
    pub id: String,
    /// Grouping key for onboarding (e.g. "discord").
    pub family: String,
    pub name: String,
    pub path: String,
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPickResult {
    pub path: String,
    pub name: String,
    pub icon_data_url: Option<String>,
    /// Durable on-disk icon under app data (survives store compaction / updates).
    pub icon_path: Option<String>,
}

struct DockState {
    /// True while Velocity is forcing dock autohide for the open phone.
    enforced: bool,
    /// User's system Dock autohide before Velocity touched it (legacy / restore).
    previous_autohide: Option<bool>,
}

struct PhoneUiState {
    corner: String,
    autohide_dock: bool,
    always_on_top: bool,
    animating: bool,
    /// Our source of truth for Shift+Tab. `is_visible()` is unreliable off the main thread
    /// (and for transparent macOS windows after a slide animation).
    shown: bool,
}

type OAuthSlot = Arc<Mutex<Option<OAuthResult>>>;
type DockSlot = Arc<Mutex<DockState>>;
type HotkeySlot = Arc<Mutex<Option<String>>>;
type PhoneUiSlot = Arc<Mutex<PhoneUiState>>;

fn logical_size(window: &WebviewWindow) -> (f64, f64) {
    if let Ok(size) = window.outer_size() {
        let scale = window.scale_factor().unwrap_or(1.0);
        return (size.width as f64 / scale, size.height as f64 / scale);
    }
    (BASE_W, BASE_H)
}

fn position_phone(window: &WebviewWindow, corner: &str) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = monitor.scale_factor();
        let work = monitor.work_area();
        // Prefer the visible work area so the phone sits above the Dock / menu bar.
        let origin_x = work.position.x as f64 / scale;
        let origin_y = work.position.y as f64 / scale;
        let screen_w = work.size.width as f64 / scale;
        let screen_h = work.size.height as f64 / scale;
        let (phone_w, phone_h) = logical_size(window);
        let margin = MARGIN as f64;

        let (x, y) = match corner {
            "bottom-left" => (origin_x + margin, origin_y + screen_h - phone_h - margin),
            "top-right" => (origin_x + screen_w - phone_w - margin, origin_y + margin),
            "top-left" => (origin_x + margin, origin_y + margin),
            _ => (
                origin_x + screen_w - phone_w - margin,
                origin_y + screen_h - phone_h - margin,
            ),
        };

        let _ = window.set_position(PhysicalPosition::new(
            (x * scale).round() as i32,
            (y * scale).round() as i32,
        ));
    }
}

fn plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn bundled_plugins_dir(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = vec![
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../plugins"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/plugins"),
        PathBuf::from("../../plugins"),
        PathBuf::from("../../../plugins"),
        PathBuf::from("plugins"),
    ];
    if let Ok(resource) = app.path().resource_dir() {
        candidates.push(resource.join("plugins"));
        candidates.push(resource.join("resources/plugins"));
    }
    candidates.into_iter().find(|p| p.exists())
}

fn read_manifest(dir: &PathBuf) -> Option<PluginManifest> {
    let manifest_path = dir.join("velocity.plugin.json");
    let raw = std::fs::read_to_string(manifest_path).ok()?;
    let mut manifest: PluginManifest = serde_json::from_str(&raw).ok()?;
    manifest.path = Some(dir.to_string_lossy().to_string());
    Some(manifest)
}

fn collect_plugins_from(root: &PathBuf, out: &mut Vec<PluginManifest>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(m) = read_manifest(&path) {
                if !out.iter().any(|existing| existing.id == m.id) {
                    out.push(m);
                }
            }
        }
    }
}

fn copy_dir(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir(&path, &target)?;
        } else {
            std::fs::copy(&path, &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

const DEFAULT_UPDATE_FEED: &str = "https://vty.dev/updates";

/// Fallback if the primary feed host is unreachable (e.g. before Pages deploy).
const FALLBACK_UPDATE_FEEDS: &[&str] = &[
    "https://raw.githubusercontent.com/InertiaUX/Velocity/main/docs/update-feed.json",
    "https://api.github.com/repos/InertiaUX/Velocity/releases/latest",
];

const DEFAULT_PLUGIN_REPO: &str = "https://vty.dev/repo";

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitHubTarget {
    owner: String,
    repo: String,
    git_ref: String,
    /// Path inside the repo (file or directory). Empty for repo root.
    path: String,
}

fn strip_git_suffix(name: &str) -> &str {
    name.strip_suffix(".git").unwrap_or(name)
}

/// Parse common github.com / raw.githubusercontent.com plugin or feed URLs.
fn parse_github_target(url: &str) -> Option<GitHubTarget> {
    let url = url.trim();
    let lower = url.to_ascii_lowercase();

    if lower.starts_with("https://raw.githubusercontent.com/")
        || lower.starts_with("http://raw.githubusercontent.com/")
    {
        // Preserve original casing from `url` by slicing the same offsets.
        let rest_orig = url.splitn(2, "githubusercontent.com/").nth(1)?;
        let mut parts = rest_orig.split('/').filter(|p| !p.is_empty());
        let owner = parts.next()?.to_string();
        let repo = strip_git_suffix(parts.next()?).to_string();
        let git_ref = parts.next().unwrap_or("main").to_string();
        let path = parts.collect::<Vec<_>>().join("/");
        return Some(GitHubTarget {
            owner,
            repo,
            git_ref,
            path,
        });
    }

    if !(lower.starts_with("https://github.com/")
        || lower.starts_with("http://github.com/")
        || lower.starts_with("https://www.github.com/")
        || lower.starts_with("http://www.github.com/"))
    {
        return None;
    }
    let rest_orig = if let Some(i) = url.to_ascii_lowercase().find("github.com/") {
        &url[i + "github.com/".len()..]
    } else {
        return None;
    };
    let rest_orig = rest_orig.trim_end_matches('/');
    // Ignore query/hash
    let rest_orig = rest_orig.split(['?', '#']).next().unwrap_or(rest_orig);

    let parts: Vec<&str> = rest_orig.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0].to_string();
    let repo = strip_git_suffix(parts[1]).to_string();

    if parts.len() == 2 {
        return Some(GitHubTarget {
            owner,
            repo,
            git_ref: "main".into(),
            path: String::new(),
        });
    }

    match parts[2] {
        "blob" | "tree" if parts.len() >= 4 => {
            let git_ref = parts[3].to_string();
            let path = parts[4..].join("/");
            Some(GitHubTarget {
                owner,
                repo,
                git_ref,
                path,
            })
        }
        "raw" if parts.len() >= 4 => {
            // github.com/owner/repo/raw/ref/path
            let git_ref = parts[3].to_string();
            let path = parts[4..].join("/");
            Some(GitHubTarget {
                owner,
                repo,
                git_ref,
                path,
            })
        }
        "archive" => None, // already a package URL
        "releases" => None, // release assets stay as-is
        _ => Some(GitHubTarget {
            owner,
            repo,
            git_ref: "main".into(),
            path: String::new(),
        }),
    }
}

fn github_raw_url(gh: &GitHubTarget) -> String {
    if gh.path.is_empty() {
        format!(
            "https://raw.githubusercontent.com/{}/{}/{}/",
            gh.owner, gh.repo, gh.git_ref
        )
    } else {
        format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            gh.owner, gh.repo, gh.git_ref, gh.path
        )
    }
}

fn github_archive_url(gh: &GitHubTarget) -> String {
    format!(
        "https://github.com/{}/{}/archive/refs/heads/{}.zip",
        gh.owner, gh.repo, gh.git_ref
    )
}

fn github_join_path(base: &str, file: &str) -> String {
    if base.is_empty() {
        file.to_string()
    } else if base.ends_with('/') {
        format!("{base}{file}")
    } else {
        format!("{base}/{file}")
    }
}

/// Candidate URLs to try when loading a plugin repository feed.
fn expand_plugin_repo_urls(input: &str) -> Vec<String> {
    let input = input.trim();
    let mut out: Vec<String> = Vec::new();
    let push = |list: &mut Vec<String>, u: String| {
        if !u.is_empty() && !list.iter().any(|x| x == &u) {
            list.push(u);
        }
    };

    push(&mut out, input.to_string());

    if let Some(gh) = parse_github_target(input) {
        let path_lower = gh.path.to_ascii_lowercase();
        if path_lower.ends_with(".json") {
            push(&mut out, github_raw_url(&gh));
        } else {
            // Repo root or directory: look for common feed filenames.
            for name in [
                "repo.json",
                "velocity-repo.json",
                "plugin-repo.json",
                "docs/plugin-repo.json",
                "docs/repo.json",
            ] {
                let mut candidate = gh.clone();
                candidate.path = github_join_path(&gh.path, name);
                push(&mut out, github_raw_url(&candidate));
            }
            // Also try a plugin manifest at this path (single-plugin GitHub repo / folder).
            let mut manifest = gh.clone();
            manifest.path = github_join_path(&gh.path, "velocity.plugin.json");
            push(&mut out, github_raw_url(&manifest));
        }
        // Alternate default branch name.
        if gh.git_ref == "main" {
            let mut master = gh.clone();
            master.git_ref = "master".into();
            if master.path.to_ascii_lowercase().ends_with(".json")
                || master.path.ends_with("velocity.plugin.json")
            {
                push(&mut out, github_raw_url(&master));
            } else {
                for name in ["repo.json", "velocity-repo.json", "plugin-repo.json"] {
                    let mut candidate = master.clone();
                    candidate.path = github_join_path(&gh.path, name);
                    push(&mut out, github_raw_url(&candidate));
                }
                let mut manifest = master;
                manifest.path = github_join_path(&gh.path, "velocity.plugin.json");
                push(&mut out, github_raw_url(&manifest));
            }
        }
    }

    out
}

fn assert_https_download_url(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("https://")
        || lower.starts_with("http://127.0.0.1")
        || lower.starts_with("http://localhost")
    {
        Ok(())
    } else {
        Err("Plugin downloads must use HTTPS (or localhost for development)".into())
    }
}

/// Turn GitHub repo / blob links into a concrete HTTPS zip (or raw) download URL.
fn normalize_plugin_download_url(url: &str) -> Result<String, String> {
    let url = url.trim();
    assert_https_download_url(url)?;
    let lower = url.to_ascii_lowercase();

    // Already a release asset or direct zip.
    if lower.contains("github.com/") && lower.contains("/releases/download/") {
        return Ok(url.to_string());
    }
    if lower.contains("github.com/") && lower.contains("/archive/") && lower.ends_with(".zip") {
        return Ok(url.to_string());
    }

    if let Some(gh) = parse_github_target(url) {
        let path_lower = gh.path.to_ascii_lowercase();
        if path_lower.ends_with(".zip") {
            return Ok(github_raw_url(&gh));
        }
        // Directory or repo root → branch archive (find_plugin_root locates the manifest).
        return Ok(github_archive_url(&gh));
    }

    Ok(url.to_string())
}

fn plugin_manifest_to_repo_feed(
    manifest: &PluginManifest,
    source_url: &str,
    download_url: String,
) -> PluginRepoFeed {
    PluginRepoFeed {
        name: format!("{} (GitHub)", manifest.name),
        url: Some(source_url.to_string()),
        updated: None,
        description: manifest.description.clone().or_else(|| {
            Some("Single plugin loaded from a GitHub link.".into())
        }),
        plugins: vec![PluginRepoEntry {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            icon: None,
            permissions: manifest.permissions.clone().unwrap_or_default(),
            provides: manifest.provides.clone().unwrap_or_default(),
            download_url,
        }],
    }
}

fn try_parse_manifest_as_repo(body: &str, source_url: &str) -> Option<PluginRepoFeed> {
    let manifest: PluginManifest = serde_json::from_str(body).ok()?;
    if manifest.id.trim().is_empty() || manifest.name.trim().is_empty() {
        return None;
    }
    let download_url = normalize_plugin_download_url(source_url)
        .ok()
        .or_else(|| {
            parse_github_target(source_url).map(|gh| github_archive_url(&gh))
        })
        .unwrap_or_else(|| source_url.to_string());
    Some(plugin_manifest_to_repo_feed(&manifest, source_url, download_url))
}

fn ureq_get(url: &str) -> Result<String, String> {
    if url.starts_with("file://") {
        let path = url.trim_start_matches("file://");
        return std::fs::read_to_string(path).map_err(|e| e.to_string());
    }
    if url.starts_with('/') || PathBuf::from(url).exists() {
        return std::fs::read_to_string(url).map_err(|e| e.to_string());
    }
    let output = std::process::Command::new("curl")
        .args([
            "-fsSL",
            "-A",
            "Velocity/0.1",
            "-H",
            "Accept: application/json",
            url,
        ])
        .output()
        .map_err(|e| format!("Failed to fetch: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Fetch failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    String::from_utf8(output.stdout).map_err(|e| e.to_string())
}

fn ureq_download(url: &str, dest: &Path) -> Result<(), String> {
    assert_https_download_url(url)?;
    let dest_str = dest
        .to_str()
        .ok_or_else(|| "Invalid download path".to_string())?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let output = std::process::Command::new("curl")
        .args(["-fsSL", "-A", "Velocity/0.1", "-L", "-o", dest_str, url])
        .output()
        .map_err(|e| format!("Failed to download plugin: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Plugin download failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let meta = std::fs::metadata(dest).map_err(|e| e.to_string())?;
    if meta.len() == 0 {
        return Err("Downloaded plugin package was empty".into());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginRepoEntry {
    id: String,
    name: String,
    version: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    permissions: Vec<String>,
    #[serde(default)]
    provides: Vec<String>,
    download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginRepoFeed {
    name: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    updated: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    plugins: Vec<PluginRepoEntry>,
}

fn parse_plugin_repo(body: &str) -> Result<PluginRepoFeed, String> {
    let feed: PluginRepoFeed =
        serde_json::from_str(body).map_err(|e| format!("Invalid plugin repo feed: {e}"))?;
    if feed.name.trim().is_empty() {
        return Err("Plugin repo is missing name".into());
    }
    for entry in &feed.plugins {
        if entry.id.trim().is_empty() || entry.name.trim().is_empty() {
            return Err("Plugin repo entry is missing id or name".into());
        }
        if entry.download_url.trim().is_empty() {
            return Err(format!("Plugin {} is missing downloadUrl", entry.id));
        }
        assert_https_download_url(&entry.download_url)?;
        // Ensure GitHub (and other) links can be normalized to a package URL.
        let _ = normalize_plugin_download_url(&entry.download_url)?;
    }
    Ok(feed)
}

#[tauri::command]
fn fetch_plugin_repo(repo_url: Option<String>) -> Result<PluginRepoFeed, String> {
    let url = repo_url
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| DEFAULT_PLUGIN_REPO.to_string());
    let candidates = expand_plugin_repo_urls(&url);
    let mut errors: Vec<String> = Vec::new();

    for candidate in &candidates {
        match ureq_get(candidate) {
            Ok(body) => {
                if let Ok(feed) = parse_plugin_repo(&body) {
                    return Ok(feed);
                }
                if let Some(feed) = try_parse_manifest_as_repo(&body, &url) {
                    return Ok(feed);
                }
                errors.push(format!("{candidate}: not a repo feed or plugin manifest"));
            }
            Err(e) => errors.push(format!("{candidate}: {e}")),
        }
    }

    Err(format!(
        "Could not load plugin repo from {url}. Tried GitHub feed paths and plugin manifests. {}",
        errors.into_iter().take(4).collect::<Vec<_>>().join(" · ")
    ))
}

#[tauri::command]
fn download_plugin_package(download_url: String) -> Result<String, String> {
    let resolved = normalize_plugin_download_url(&download_url)?;
    let mut dest = std::env::temp_dir();
    dest.push(format!(
        "velocity-plugin-{}-{}.zip",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    // Prefer requested branch archive; if main 404s, try master for bare repo links.
    if let Err(e) = ureq_download(&resolved, &dest) {
        if let Some(gh) = parse_github_target(&download_url) {
            if gh.git_ref == "main" {
                let mut master = gh;
                master.git_ref = "master".into();
                let fallback = github_archive_url(&master);
                if fallback != resolved {
                    ureq_download(&fallback, &dest)?;
                    return Ok(dest.to_string_lossy().to_string());
                }
            }
        }
        return Err(e);
    }
    Ok(dest.to_string_lossy().to_string())
}

fn macos_dock_autohide_get() -> Option<bool> {
    let output = std::process::Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get autohide of dock preferences",
        ])
        .output()
        .ok()?;
    if output.status.success() {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
        if s == "true" {
            return Some(true);
        }
        if s == "false" {
            return Some(false);
        }
    }
    let output = std::process::Command::new("defaults")
        .args(["read", "com.apple.dock", "autohide"])
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Some(s == "1" || s.eq_ignore_ascii_case("true"))
}

/// Restore the user's system Dock autohide preference.
/// Never restarts Dock (`killall Dock` unminimizes windows).
fn macos_dock_autohide_restore(previous: bool) {
    let val = if previous { "true" } else { "false" };
    // Prefer System Events (live apply). Fall back to defaults write only.
    let status = std::process::Command::new("osascript")
        .args([
            "-e",
            &format!(
                "tell application \"System Events\" to set autohide of dock preferences to {val}"
            ),
        ])
        .status();
    if !matches!(status, Ok(s) if s.success()) {
        let _ = std::process::Command::new("defaults")
            .args(["write", "com.apple.dock", "autohide", "-bool", val])
            .status();
    }
}

fn dock_marker_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("dock-autohide-restore.json"))
}

fn write_dock_restore_marker(app: &AppHandle, previous_autohide: bool) {
    let Some(path) = dock_marker_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(
        path,
        serde_json::json!({ "previousAutohide": previous_autohide }).to_string(),
    );
}

fn take_dock_restore_marker(app: &AppHandle) -> Option<bool> {
    let path = dock_marker_path(app)?;
    let raw = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("previousAutohide").and_then(|x| x.as_bool())
}

/// Hide/show the Dock via app presentation options - does NOT change the user's
/// system Dock preference, so minimized windows stay minimized.
#[cfg(target_os = "macos")]
fn macos_set_presentation_dock_autohide(enabled: bool) {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSApplication, NSApplicationPresentationOptions};

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    if enabled {
        app.setPresentationOptions(NSApplicationPresentationOptions::AutoHideDock);
    } else {
        app.setPresentationOptions(NSApplicationPresentationOptions::empty());
    }
}

#[cfg(not(target_os = "macos"))]
fn macos_set_presentation_dock_autohide(_enabled: bool) {}

fn run_on_main(app: &AppHandle, f: impl FnOnce() + Send + 'static) {
    let _ = app.run_on_main_thread(f);
}

/// Run `f` on the AppKit main thread and wait. Avoids deadlocking when already on main.
fn run_on_main_sync<T: Send + 'static>(
    app: &AppHandle,
    f: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::MainThreadMarker;
        if MainThreadMarker::new().is_some() {
            return Ok(f());
        }
    }

    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

fn with_window_main<T: Send + 'static>(
    window: &WebviewWindow,
    f: impl FnOnce(&WebviewWindow) -> T + Send + 'static,
) -> Result<T, String> {
    let app = window.app_handle().clone();
    let window = window.clone();
    run_on_main_sync(&app, move || f(&window))
}

fn enforce_dock_autohide(app: &AppHandle, dock: &DockSlot, enabled: bool) {
    if !enabled {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        let mut guard = match dock.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if guard.enforced {
            return;
        }
        // Remember system preference for quit-restore / crash recovery, but do not
        // mutate it while running - presentation options hide the Dock instead.
        let previous = macos_dock_autohide_get().unwrap_or(false);
        guard.previous_autohide = Some(previous);
        guard.enforced = true;
        write_dock_restore_marker(app, previous);
        drop(guard);
        let handle = app.clone();
        run_on_main(&handle, || macos_set_presentation_dock_autohide(true));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, dock, enabled);
    }
}

fn release_dock_autohide(app: &AppHandle, dock: &DockSlot) {
    #[cfg(target_os = "macos")]
    {
        let mut guard = match dock.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if !guard.enforced {
            return;
        }
        let previous = guard.previous_autohide.take();
        guard.enforced = false;
        drop(guard);

        let handle = app.clone();
        run_on_main(&handle, || macos_set_presentation_dock_autohide(false));

        // We no longer flip the system Dock preference while running. Only restore
        // if it drifted (e.g. leftover from an older Velocity build).
        if let Some(prev) = previous {
            if macos_dock_autohide_get() != Some(prev) {
                macos_dock_autohide_restore(prev);
            }
        }
        let _ = take_dock_restore_marker(app);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, dock);
    }
}

fn restore_dock_on_shutdown(app: &AppHandle, dock: &DockSlot) {
    #[cfg(target_os = "macos")]
    {
        run_on_main(app, || macos_set_presentation_dock_autohide(false));
        let previous = dock
            .lock()
            .ok()
            .and_then(|mut g| {
                let prev = g.previous_autohide.take();
                g.enforced = false;
                prev
            })
            .or_else(|| take_dock_restore_marker(app));
        if let Some(prev) = previous {
            // Put the Dock back to the user's normal preference if we (or an
            // older Velocity) left it changed.
            if macos_dock_autohide_get() != Some(prev) {
                macos_dock_autohide_restore(prev);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, dock);
    }
}

/// Extract a macOS app/file icon and shrink it - NSWorkspace icons are often multi‑MB.
fn extract_macos_icon_file(path: &PathBuf) -> Option<PathBuf> {
    let tmp = std::env::temp_dir().join(format!("velocity-icon-{}.png", uuid::Uuid::new_v4()));
    let tmp_out = std::env::temp_dir().join(format!("velocity-icon-{}-sm.png", uuid::Uuid::new_v4()));
    let js = format!(
        r#"ObjC.import('AppKit');
const path = {path};
const out = {out};
const img = $.NSWorkspace.sharedWorkspace.iconForFile(path);
img.setSize($.NSMakeSize(128, 128));
const tiff = img.TIFFRepresentation;
const rep = $.NSBitmapImageRep.imageRepWithData(tiff);
const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
png.writeToFileAtomically(out, true);"#,
        path = serde_json::to_string(&path.to_string_lossy().to_string()).ok()?,
        out = serde_json::to_string(&tmp.to_string_lossy().to_string()).ok()?,
    );
    let status = std::process::Command::new("osascript")
        .args(["-l", "JavaScript", "-e", &js])
        .status()
        .ok()?;
    if !status.success() || !tmp.exists() {
        let _ = std::fs::remove_file(&tmp);
        return None;
    }
    // Force a small PNG - raw NSWorkspace dumps are frequently >1MB
    let sips_ok = std::process::Command::new("sips")
        .args([
            "-z",
            "128",
            "128",
            "-s",
            "format",
            "png",
            tmp.to_str()?,
            "--out",
            tmp_out.to_str()?,
        ])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
        && tmp_out.exists();
    let final_path = if sips_ok {
        let _ = std::fs::remove_file(&tmp);
        tmp_out
    } else {
        let _ = std::fs::remove_file(&tmp_out);
        if tmp.exists() {
            tmp
        } else {
            return None;
        }
    };
    let meta = std::fs::metadata(&final_path).ok()?;
    if meta.len() == 0 || meta.len() > 500_000 {
        let _ = std::fs::remove_file(&final_path);
        return None;
    }
    Some(final_path)
}

fn extract_macos_icon(path: &PathBuf) -> Option<String> {
    let file = extract_macos_icon_file(path)?;
    let bytes = std::fs::read(&file).ok()?;
    let _ = std::fs::remove_file(&file);
    if bytes.len() > 350_000 {
        return None;
    }
    Some(format!("data:image/png;base64,{}", B64.encode(bytes)))
}

/// Save a macOS app icon straight to tile-icons (avoids huge base64 round-trips).
fn persist_macos_app_icon(app: &AppHandle, app_path: &PathBuf) -> Option<String> {
    let src = extract_macos_icon_file(app_path)?;
    let dest = new_tile_icon_dest(app, "png").ok()?;
    if std::fs::copy(&src, &dest).is_err() {
        let _ = std::fs::remove_file(&src);
        return None;
    }
    let _ = std::fs::remove_file(&src);
    Some(dest.to_string_lossy().to_string())
}

fn display_name_for_path(path: &PathBuf) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "App".into())
}

fn parse_hotkey(s: &str) -> Result<Shortcut, String> {
    let lower = s.to_lowercase().replace(' ', "");
    let mut mods = Modifiers::empty();
    let mut key = lower.as_str();
    if let Some(rest) = key.strip_prefix("shift+") {
        mods |= Modifiers::SHIFT;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("ctrl+") {
        mods |= Modifiers::CONTROL;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("control+") {
        mods |= Modifiers::CONTROL;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("alt+") {
        mods |= Modifiers::ALT;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("option+") {
        mods |= Modifiers::ALT;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("cmd+") {
        mods |= Modifiers::SUPER;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("meta+") {
        mods |= Modifiers::SUPER;
        key = rest;
    }
    if let Some(rest) = key.strip_prefix("super+") {
        mods |= Modifiers::SUPER;
        key = rest;
    }
    let code = match key {
        "tab" => Code::Tab,
        "space" => Code::Space,
        "escape" | "esc" => Code::Escape,
        "v" => Code::KeyV,
        "p" => Code::KeyP,
        "h" => Code::KeyH,
        "grave" | "`" => Code::Backquote,
        other if other.len() == 1 => {
            let c = other.chars().next().unwrap().to_ascii_uppercase();
            match c {
                'A'..='Z' => {
                    // Map letter keys
                    match c {
                        'A' => Code::KeyA,
                        'B' => Code::KeyB,
                        'C' => Code::KeyC,
                        'D' => Code::KeyD,
                        'E' => Code::KeyE,
                        'F' => Code::KeyF,
                        'G' => Code::KeyG,
                        'H' => Code::KeyH,
                        'I' => Code::KeyI,
                        'J' => Code::KeyJ,
                        'K' => Code::KeyK,
                        'L' => Code::KeyL,
                        'M' => Code::KeyM,
                        'N' => Code::KeyN,
                        'O' => Code::KeyO,
                        'P' => Code::KeyP,
                        'Q' => Code::KeyQ,
                        'R' => Code::KeyR,
                        'S' => Code::KeyS,
                        'T' => Code::KeyT,
                        'U' => Code::KeyU,
                        'V' => Code::KeyV,
                        'W' => Code::KeyW,
                        'X' => Code::KeyX,
                        'Y' => Code::KeyY,
                        'Z' => Code::KeyZ,
                        _ => return Err(format!("Unsupported key: {s}")),
                    }
                }
                _ => return Err(format!("Unsupported key: {s}")),
            }
        }
        _ => return Err(format!("Unsupported hotkey: {s}")),
    };
    Ok(Shortcut::new(Some(mods), code))
}

#[tauri::command]
fn place_phone(
    window: WebviewWindow,
    corner: String,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    if let Ok(mut guard) = ui.lock() {
        guard.corner = corner.clone();
    }
    position_phone(&window, &corner);
    Ok(())
}

/// Convert the Tauri NSWindow into an NSPanel and configure it for fullscreen Spaces.
///
/// Plain NSWindows ignore `FullScreenAuxiliary` on modern macOS — only panels can
/// appear over another app's fullscreen Space. Re-applies flags on every show
/// (hide/show can reset collection behavior / level).
#[cfg(target_os = "macos")]
fn macos_apply_space_overlay(window: &WebviewWindow, _elevate: bool, order_front: bool) {
    use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
    use objc2::{sel, ClassType, MainThreadMarker};
    use objc2_app_kit::{
        NSMainMenuWindowLevel, NSPanel, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
    };
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;

    static CONVERTED: AtomicBool = AtomicBool::new(false);
    static PANEL_CLASS: OnceLock<&'static AnyClass> = OnceLock::new();

    extern "C" {
        fn object_setClass(obj: *mut AnyObject, cls: *const AnyClass) -> *const AnyClass;
    }

    unsafe extern "C" fn can_become_key_window(_this: *mut AnyObject, _cmd: Sel) -> Bool {
        Bool::YES
    }
    unsafe extern "C" fn can_become_main_window(_this: *mut AnyObject, _cmd: Sel) -> Bool {
        Bool::YES
    }

    let panel_class = *PANEL_CLASS.get_or_init(|| {
        let name = c"VelocityPhonePanel";
        if let Some(existing) = AnyClass::get(name) {
            return existing;
        }
        let mut builder = ClassBuilder::new(name, NSPanel::class())
            .expect("VelocityPhonePanel ClassBuilder");
        unsafe {
            builder.add_method(
                sel!(canBecomeKeyWindow),
                can_become_key_window as unsafe extern "C" fn(_, _) -> _,
            );
            builder.add_method(
                sel!(canBecomeMainWindow),
                can_become_main_window as unsafe extern "C" fn(_, _) -> _,
            );
        }
        builder.register()
    });

    let Ok(ptr) = window.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }
    if MainThreadMarker::new().is_none() {
        return;
    }

    let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary
        | NSWindowCollectionBehavior::CanJoinAllApplications
        | NSWindowCollectionBehavior::Stationary;

    unsafe {
        let ns_window: &NSWindow = &*(ptr as *const NSWindow);

        // Drop any previous child-of-anchor link from older builds.
        if let Some(parent) = ns_window.parentWindow() {
            parent.removeChildWindow(ns_window);
        }

        if !CONVERTED.swap(true, Ordering::SeqCst) {
            object_setClass(ptr as *mut AnyObject, panel_class);
        }

        // Keep borderless (transparent phone) and mark as nonactivating panel so
        // showing over a fullscreen game doesn't yank that app out of its Space.
        ns_window.setStyleMask(
            NSWindowStyleMask::Borderless | NSWindowStyleMask::NonactivatingPanel,
        );

        // NSPanel-specific (safe after class swizzle).
        let panel: &NSPanel = &*(ptr as *const NSPanel);
        panel.setFloatingPanel(true);
        panel.setBecomesKeyOnlyIfNeeded(false);
        panel.setWorksWhenModal(true);

        ns_window.setCollectionBehavior(behavior);
        ns_window.setLevel(NSMainMenuWindowLevel);
        ns_window.setHidesOnDeactivate(false);
        ns_window.setMovableByWindowBackground(false);

        if order_front {
            ns_window.orderFrontRegardless();
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn macos_apply_space_overlay(_window: &WebviewWindow, _elevate: bool, _order_front: bool) {}

#[cfg(target_os = "macos")]
fn macos_is_on_active_space(window: &WebviewWindow) -> bool {
    with_window_main(window, |window| {
        let Ok(ptr) = window.ns_window() else {
            return true;
        };
        if ptr.is_null() {
            return true;
        }
        unsafe {
            let ns_window: &objc2_app_kit::NSWindow = &*(ptr as *const objc2_app_kit::NSWindow);
            ns_window.isOnActiveSpace()
        }
    })
    .unwrap_or(true)
}

#[cfg(not(target_os = "macos"))]
fn macos_is_on_active_space(_window: &WebviewWindow) -> bool {
    true
}

fn apply_always_on_top(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    // NSWindow level changes must run on the main thread (macOS 26 traps otherwise).
    // Shift+Tab toggles from a worker thread, so marshal AppKit work here.
    with_window_main(window, move |window| {
        window
            .set_always_on_top(enabled)
            .map_err(|e| e.to_string())?;
        let _ = window.set_visible_on_all_workspaces(true);
        macos_apply_space_overlay(&window, enabled, false);
        Ok(())
    })?
}

#[tauri::command]
fn set_always_on_top(
    window: WebviewWindow,
    enabled: bool,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    if let Ok(mut guard) = ui.lock() {
        guard.always_on_top = enabled;
    }
    apply_always_on_top(&window, enabled)
}

#[tauri::command]
fn show_phone(window: WebviewWindow) -> Result<(), String> {
    with_window_main(&window, |window| {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_visible_on_all_workspaces(true);
        macos_apply_space_overlay(window, true, true);
        Ok(())
    })?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizePhoneResult {
    pub applied_scale: f64,
    pub logical_w: f64,
    pub logical_h: f64,
    pub physical_w: u32,
    pub physical_h: u32,
}

fn clamp_scale(scale: f64) -> f64 {
    scale.clamp(SCALE_MIN, SCALE_MAX)
}

fn work_area_logical(window: &WebviewWindow) -> Option<(f64, f64)> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    Some((
        work.size.width as f64 / scale,
        work.size.height as f64 / scale,
    ))
}

/// Clamp short side so the phone fits the monitor work area (minus margin).
fn clamp_short_to_work_area(short: f64, landscape: bool, window: &WebviewWindow) -> f64 {
    let short = short.clamp(BASE_W * SCALE_MIN, BASE_W * SCALE_MAX);
    let Some((work_w, work_h)) = work_area_logical(window) else {
        return short;
    };
    let usable_w = (work_w - (MARGIN as f64) * 2.0).max(1.0);
    let usable_h = (work_h - (MARGIN as f64) * 2.0).max(1.0);
    let (design_w, design_h) = if landscape {
        (BASE_H, BASE_W)
    } else {
        (BASE_W, BASE_H)
    };
    // short = design_short * scale; for portrait design_short = BASE_W.
    let max_by_w = usable_w / design_w * BASE_W;
    let max_by_h = usable_h / design_h * BASE_W;
    let max_short = max_by_w.min(max_by_h).min(BASE_W * SCALE_MAX);
    short.min(max_short).max(BASE_W * SCALE_MIN)
}

#[tauri::command]
fn resize_phone(
    window: WebviewWindow,
    width: f64,
    corner: String,
    anchor: Option<String>,
    snap_to_corner: Option<bool>,
    landscape: Option<bool>,
    placement: Option<String>,
) -> Result<ResizePhoneResult, String> {
    // `width` is the phone's short side (portrait width). Landscape flips the frame.
    let is_landscape = landscape.unwrap_or(false);
    let short = clamp_short_to_work_area(width, is_landscape, &window);
    let long = (short * ASPECT).round();
    let (w, h) = if is_landscape {
        (long, short)
    } else {
        (short, long)
    };
    let old_pos = window.outer_position().ok();
    let old_size = window.outer_size().ok();
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let target_w = (w * scale_factor).round().max(1.0) as u32;
    let target_h = (h * scale_factor).round().max(1.0) as u32;

    // PhysicalSize is more reliable than LogicalSize on undecorated macOS windows.
    window
        .set_size(PhysicalSize::new(target_w, target_h))
        .map_err(|e| e.to_string())?;
    // Retry once if the OS ignored the first set (seen with transparent windows).
    if let Ok(measured) = window.outer_size() {
        if (measured.width as i64 - target_w as i64).abs() > 2
            || (measured.height as i64 - target_h as i64).abs() > 2
        {
            let _ = window.set_size(LogicalSize::new(w, h));
            let _ = window.set_size(PhysicalSize::new(target_w, target_h));
        }
    }

    // Resolve placement: explicit string wins; else legacy snap/anchor flags.
    let placement_mode = placement
        .as_deref()
        .map(|p| p.to_ascii_lowercase())
        .unwrap_or_else(|| {
            if snap_to_corner.unwrap_or(false) {
                "snap".into()
            } else if anchor.is_some() {
                "anchor".into()
            } else {
                "keep".into()
            }
        });

    match placement_mode.as_str() {
        "snap" => {
            position_phone(&window, &corner);
        }
        "anchor" => {
            let Some(a) = anchor.as_deref() else {
                return Err("anchor placement requires anchor".into());
            };
            // Opposite-corner math uses pre-size outer rect + target physical size
            // (do not wait on stale outer_size after set_size).
            if let (Some(pos), Some(old_size)) = (old_pos, old_size) {
                let old_w = old_size.width as f64;
                let old_h = old_size.height as f64;
                let new_w = target_w as f64;
                let new_h = target_h as f64;
                let (nx, ny) = match a {
                    "nw" => (pos.x as f64 + (old_w - new_w), pos.y as f64 + (old_h - new_h)),
                    "ne" => (pos.x as f64, pos.y as f64 + (old_h - new_h)),
                    "sw" => (pos.x as f64 + (old_w - new_w), pos.y as f64),
                    // se - keep top-left fixed
                    _ => (pos.x as f64, pos.y as f64),
                };
                window
                    .set_position(PhysicalPosition::new(nx.round() as i32, ny.round() as i32))
                    .map_err(|e| e.to_string())?;
            }
        }
        // "keep" - leave position alone (OS keeps top-left on size change).
        _ => {}
    }

    let (physical_w, physical_h) = window
        .outer_size()
        .map(|s| (s.width, s.height))
        .unwrap_or((target_w, target_h));

    Ok(ResizePhoneResult {
        applied_scale: clamp_scale(short / BASE_W),
        logical_w: w,
        logical_h: h,
        physical_w,
        physical_h,
    })
}

#[cfg(not(target_os = "macos"))]
fn ease_in_cubic(t: f64) -> f64 {
    t * t * t
}

#[cfg(not(target_os = "macos"))]
fn ease_out_cubic(t: f64) -> f64 {
    let u = 1.0 - t;
    1.0 - u * u * u
}

const PHONE_SLIDE_HIDE_SECS: f64 = 0.26;
const PHONE_SLIDE_SHOW_SECS: f64 = 0.30;

/// AppKit-driven slide. Much smoother than per-frame Tauri `set_position` + sync
/// main-thread hops (those looked stepped / laggy).
#[cfg(target_os = "macos")]
fn macos_slide_frame(
    window: &WebviewWindow,
    delta_y_cocoa: f64,
    duration_secs: f64,
) -> Result<(), String> {
    with_window_main(window, move |window| {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        use objc2_foundation::{NSPoint, NSRect, NSSize};

        let ptr = window.ns_window().map_err(|e| e.to_string())?;
        if ptr.is_null() {
            return Err("missing ns_window".to_string());
        }
        let ns_window = ptr as *mut AnyObject;
        unsafe {
            let frame: NSRect = msg_send![ns_window, frame];
            let target = NSRect {
                origin: NSPoint {
                    x: frame.origin.x,
                    y: frame.origin.y + delta_y_cocoa,
                },
                size: NSSize {
                    width: frame.size.width,
                    height: frame.size.height,
                },
            };
            // NSAnimationContext + animator uses Core Animation timing instead of
            // our old stepped loop.
            let _: () = msg_send![objc2::class!(NSAnimationContext), beginGrouping];
            let ctx: *mut AnyObject =
                msg_send![objc2::class!(NSAnimationContext), currentContext];
            let _: () = msg_send![ctx, setDuration: duration_secs];
            let _: () = msg_send![ctx, setAllowsImplicitAnimation: true];
            let animator: *mut AnyObject = msg_send![ns_window, animator];
            let _: () = msg_send![animator, setFrame: target, display: true];
            let _: () = msg_send![objc2::class!(NSAnimationContext), endGrouping];
        }
        Ok::<(), String>(())
    })??;
    // Animation runs on the main runloop; wait on this worker thread.
    thread::sleep(Duration::from_secs_f64(duration_secs + 0.02));
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_set_frame_y_delta(window: &WebviewWindow, delta_y_cocoa: f64) -> Result<(), String> {
    with_window_main(window, move |window| {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        use objc2_foundation::{NSPoint, NSRect, NSSize};

        let ptr = window.ns_window().map_err(|e| e.to_string())?;
        if ptr.is_null() {
            return Err("missing ns_window".to_string());
        }
        let ns_window = ptr as *mut AnyObject;
        unsafe {
            let frame: NSRect = msg_send![ns_window, frame];
            let target = NSRect {
                origin: NSPoint {
                    x: frame.origin.x,
                    y: frame.origin.y + delta_y_cocoa,
                },
                size: NSSize {
                    width: frame.size.width,
                    height: frame.size.height,
                },
            };
            let _: () = msg_send![ns_window, setFrame: target, display: true];
        }
        Ok::<(), String>(())
    })?
}

#[cfg(target_os = "macos")]
fn macos_frame_travel_points(window: &WebviewWindow) -> Result<f64, String> {
    with_window_main(window, |window| {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        use objc2_foundation::NSRect;

        let ptr = window.ns_window().map_err(|e| e.to_string())?;
        if ptr.is_null() {
            return Err("missing ns_window".to_string());
        }
        let ns_window = ptr as *mut AnyObject;
        let frame: NSRect = unsafe { msg_send![ns_window, frame] };
        Ok::<f64, String>(frame.size.height + 64.0)
    })?
}

/// Fallback when AppKit animation isn't available: time-based slides with
/// fire-and-forget main-thread moves (no sync wait per frame).
#[cfg(not(target_os = "macos"))]
fn animate_slide_fallback(
    window: &WebviewWindow,
    x: i32,
    from_y: i32,
    to_y: i32,
    duration: Duration,
    ease_out: bool,
) -> Result<(), String> {
    use std::time::Instant;
    let start = Instant::now();
    let mut last_y = from_y;
    while start.elapsed() < duration {
        let t = (start.elapsed().as_secs_f64() / duration.as_secs_f64()).clamp(0.0, 1.0);
        let e = if ease_out {
            ease_out_cubic(t)
        } else {
            ease_in_cubic(t)
        };
        let y = (from_y as f64 + (to_y - from_y) as f64 * e).round() as i32;
        if y != last_y {
            last_y = y;
            let w = window.clone();
            let _ = w.clone().app_handle().run_on_main_thread(move || {
                let _ = w.set_position(PhysicalPosition::new(x, y));
            });
        }
        thread::sleep(Duration::from_millis(8));
    }
    with_window_main(window, move |window| {
        let _ = window.set_position(PhysicalPosition::new(x, to_y));
    })?;
    Ok(())
}

fn force_hide_window(window: &WebviewWindow) -> Result<(), String> {
    with_window_main(window, |window| {
        window.hide().map_err(|e| e.to_string())?;
        // Transparent / floating NSWindows sometimes stay on the window list after
        // Tauri hide(); orderOut makes the tuck-away definitive for Shift+Tab.
        #[cfg(target_os = "macos")]
        {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            if let Ok(ptr) = window.ns_window() {
                if !ptr.is_null() {
                    let ns_window = ptr as *mut AnyObject;
                    unsafe {
                        let _: () = msg_send![ns_window, orderOut: std::ptr::null::<AnyObject>()];
                    }
                }
            }
        }
        Ok(())
    })?
}

fn animate_phone_down(window: &WebviewWindow) -> Result<(), String> {
    let _ = browser_hide_webview(&window.app_handle());

    #[cfg(target_os = "macos")]
    {
        // Cocoa Y grows upward — slide off the bottom by decreasing origin.y.
        let travel = macos_frame_travel_points(window)?;
        macos_slide_frame(window, -travel, PHONE_SLIDE_HIDE_SECS)?;
        return force_hide_window(window);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let (scale, pos, size) = with_window_main(window, |window| {
            let scale = window.scale_factor().unwrap_or(1.0);
            let pos = window.outer_position().map_err(|e| e.to_string())?;
            let size = window.outer_size().map_err(|e| e.to_string())?;
            Ok::<_, String>((scale, pos, size))
        })??;
        let travel = size.height as i32 + (64.0 * scale) as i32;
        animate_slide_fallback(
            window,
            pos.x,
            pos.y,
            pos.y + travel,
            Duration::from_secs_f64(PHONE_SLIDE_HIDE_SECS),
            false,
        )?;
        force_hide_window(window)
    }
}

fn animate_phone_up(window: &WebviewWindow, corner: &str, elevate: bool) -> Result<(), String> {
    let corner = corner.to_string();
    // Show before reading geometry - hidden windows often fail position APIs on macOS,
    // which previously aborted restore and left Velocity "stuck" after Shift+Tab.
    with_window_main(window, {
        let corner = corner.clone();
        move |window| {
            let _ = window.unminimize();
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_visible_on_all_workspaces(true);
            // orderFrontRegardless + space overlay so the phone can appear over a
            // fullscreen game without yanking that app out of its Space (set_focus can).
            macos_apply_space_overlay(window, elevate, true);
            position_phone(window, &corner);
            Ok::<_, String>(())
        }
    })??;

    #[cfg(target_os = "macos")]
    {
        let travel = macos_frame_travel_points(window)?;
        // Park below, then animate up into the resting corner.
        macos_set_frame_y_delta(window, -travel)?;
        macos_slide_frame(window, travel, PHONE_SLIDE_SHOW_SECS)?;
        with_window_main(window, {
            let corner = corner.clone();
            move |window| {
                position_phone(window, &corner);
                macos_apply_space_overlay(window, elevate, true);
            }
        })?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let prep = with_window_main(window, {
            let corner = corner.clone();
            move |window| {
                let scale = window.scale_factor().unwrap_or(1.0);
                position_phone(window, &corner);
                let size = window.outer_size().ok();
                let travel = size
                    .map(|s| s.height as i32 + (64.0 * scale) as i32)
                    .unwrap_or((800.0 * scale) as i32);
                let Ok(final_pos) = window.outer_position() else {
                    return Ok::<_, String>(None);
                };
                let start = PhysicalPosition::new(final_pos.x, final_pos.y + travel);
                let _ = window.set_position(start);
                Ok(Some((final_pos, start)))
            }
        })??;

        let Some((final_pos, start)) = prep else {
            return Ok(());
        };
        animate_slide_fallback(
            window,
            final_pos.x,
            start.y,
            final_pos.y,
            Duration::from_secs_f64(PHONE_SLIDE_SHOW_SECS),
            true,
        )?;
        with_window_main(window, {
            let corner = corner.clone();
            move |window| {
                position_phone(window, &corner);
            }
        })?;
        Ok(())
    }
}

fn run_minimize(window: &WebviewWindow, dock: &DockSlot, ui: &PhoneUiSlot) -> Result<(), String> {
    {
        let mut guard = ui.lock().map_err(|e| e.to_string())?;
        if guard.animating {
            return Ok(());
        }
        guard.animating = true;
    }
    let result = (|| {
        animate_phone_down(window)?;
        release_dock_autohide(&window.app_handle(), dock);
        if let Ok(mut guard) = ui.lock() {
            guard.shown = false;
        }
        let _ = window.emit("velocity://visibility", false);
        Ok(())
    })();
    if result.is_err() {
        // Best-effort: don't leave the phone stuck mid-slide.
        let _ = force_hide_window(window);
        if let Ok(mut guard) = ui.lock() {
            guard.shown = false;
            guard.animating = false;
        }
        let _ = window.emit("velocity://visibility", false);
    } else if let Ok(mut guard) = ui.lock() {
        guard.animating = false;
    }
    result
}

fn run_restore(
    window: &WebviewWindow,
    corner: String,
    autohide_dock: bool,
    dock: &DockSlot,
    ui: &PhoneUiSlot,
) -> Result<(), String> {
    {
        let mut guard = ui.lock().map_err(|e| e.to_string())?;
        if guard.animating {
            return Ok(());
        }
        guard.animating = true;
        guard.corner = corner.clone();
        guard.autohide_dock = autohide_dock;
    }
    let always_on_top = ui
        .lock()
        .map(|g| g.always_on_top)
        .unwrap_or(false);
    let result = (|| {
        animate_phone_up(window, &corner, always_on_top)?;
        // Re-apply after show - macOS often resets window level on hide/show.
        apply_always_on_top(window, always_on_top)?;
        enforce_dock_autohide(&window.app_handle(), dock, autohide_dock);
        if let Ok(mut guard) = ui.lock() {
            guard.shown = true;
        }
        let _ = window.emit("velocity://visibility", true);
        Ok(())
    })();
    if let Ok(mut guard) = ui.lock() {
        guard.animating = false;
        if result.is_ok() {
            guard.shown = true;
        }
    }
    result
}

fn run_toggle(
    window: &WebviewWindow,
    corner: Option<String>,
    autohide_dock: Option<bool>,
    dock: &DockSlot,
    ui: &PhoneUiSlot,
) -> Result<bool, String> {
    let (corner, autohide, shown) = {
        let mut guard = ui.lock().map_err(|e| e.to_string())?;
        if guard.animating {
            return Ok(guard.shown);
        }
        if let Some(c) = corner {
            guard.corner = c;
        }
        if let Some(a) = autohide_dock {
            guard.autohide_dock = a;
        }
        (guard.corner.clone(), guard.autohide_dock, guard.shown)
    };

    // Phone can be "shown" on the desktop Space while the user is in another
    // app's fullscreen Space — Shift+Tab should re-surface there, not hide.
    if shown {
        let on_active = macos_is_on_active_space(window);
        let visibly_here = window.is_visible().unwrap_or(false) && on_active;
        if visibly_here {
            run_minimize(window, dock, ui)?;
            return Ok(false);
        }
        // Treat as hidden for this Space and bring it back on top.
    }

    run_restore(window, corner, autohide, dock, ui)?;
    Ok(true)
}

#[tauri::command]
fn minimize_phone(
    window: WebviewWindow,
    dock: tauri::State<'_, DockSlot>,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    run_minimize(&window, &dock, &ui)
}

#[tauri::command]
fn restore_phone(
    window: WebviewWindow,
    corner: String,
    autohide_dock: bool,
    dock: tauri::State<'_, DockSlot>,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    run_restore(&window, corner, autohide_dock, &dock, &ui)
}

#[tauri::command]
fn toggle_phone(
    window: WebviewWindow,
    corner: Option<String>,
    autohide_dock: Option<bool>,
    dock: tauri::State<'_, DockSlot>,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<bool, String> {
    run_toggle(&window, corner, autohide_dock, &dock, &ui)
}

#[tauri::command]
fn sync_phone_prefs(
    corner: String,
    autohide_dock: bool,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    let mut guard = ui.lock().map_err(|e| e.to_string())?;
    guard.corner = corner;
    guard.autohide_dock = autohide_dock;
    Ok(())
}

#[tauri::command]
fn set_dock_autohide_while_active(
    app: AppHandle,
    enabled: bool,
    phone_visible: bool,
    dock: tauri::State<'_, DockSlot>,
    ui: tauri::State<'_, PhoneUiSlot>,
) -> Result<(), String> {
    if let Ok(mut guard) = ui.lock() {
        guard.autohide_dock = enabled;
    }
    if enabled && phone_visible {
        enforce_dock_autohide(&app, &dock, true);
    } else {
        release_dock_autohide(&app, &dock);
    }
    Ok(())
}

#[tauri::command]
fn set_show_in_dock(app: AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.set_dock_visibility(visible)
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, visible);
    }
    Ok(())
}

fn velocity_app_bundle_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    for ancestor in exe.ancestors() {
        if ancestor.extension().and_then(|e| e.to_str()) == Some("app") {
            return Some(ancestor.to_path_buf());
        }
    }
    // Dev / installed fallbacks
    let home = std::env::var("HOME").ok()?;
    let candidates = [
        PathBuf::from(format!("{home}/Applications/Velocity.app")),
        PathBuf::from("/Applications/Velocity.app"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

#[cfg(target_os = "macos")]
fn macos_bookmark_for_app(path: &std::path::Path) -> Result<Vec<u8>, String> {
    use objc2_foundation::{
        NSString, NSURL, NSURLBookmarkCreationOptions,
    };
    let ns_path = NSString::from_str(&path.to_string_lossy());
    let url = NSURL::fileURLWithPath_isDirectory(&ns_path, true);
    let data = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::MinimalBookmark,
            None,
            None,
        )
        .map_err(|e| format!("Could not create Dock bookmark: {e}"))?;
    Ok(data.to_vec())
}

#[cfg(target_os = "macos")]
fn dock_tile_is_velocity(tile: &plist::Value) -> bool {
    let Some(td) = tile
        .as_dictionary()
        .and_then(|d| d.get("tile-data"))
        .and_then(|v| v.as_dictionary())
    else {
        return false;
    };
    if td
        .get("bundle-identifier")
        .and_then(|v| v.as_string())
        .is_some_and(|s| s == "com.inertiaux.velocity")
    {
        return true;
    }
    if td
        .get("file-label")
        .and_then(|v| v.as_string())
        .is_some_and(|s| s.eq_ignore_ascii_case("velocity"))
    {
        return true;
    }
    td.get("file-data")
        .and_then(|v| v.as_dictionary())
        .and_then(|fd| fd.get("_CFURLString"))
        .and_then(|v| v.as_string())
        .is_some_and(|url| url.to_ascii_lowercase().contains("velocity.app"))
}

#[cfg(target_os = "macos")]
fn dock_already_keeps_velocity(apps: &[plist::Value], bundle_uri: &str) -> bool {
    apps.iter().any(|tile| {
        if !dock_tile_is_velocity(tile) {
            return false;
        }
        tile.as_dictionary()
            .and_then(|d| d.get("tile-data"))
            .and_then(|v| v.as_dictionary())
            .and_then(|td| td.get("file-data"))
            .and_then(|v| v.as_dictionary())
            .and_then(|fd| fd.get("_CFURLString"))
            .and_then(|v| v.as_string())
            .is_some_and(|url| {
                url == bundle_uri || url.trim_end_matches('/') == bundle_uri.trim_end_matches('/')
            })
    })
}

/// Add or remove Velocity.app from the Dock's persistent apps (Keep in Dock).
/// Writes a real NSURL bookmark (required on modern macOS) and relaunches Dock
/// so the tile appears immediately.
#[tauri::command]
fn set_keep_in_dock(keep: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use plist::{Dictionary, Value};
        use std::fs;
        use std::process::Command;

        let bundle = velocity_app_bundle_path()
            .ok_or_else(|| "Could not locate Velocity.app".to_string())?;
        if !bundle.exists() {
            return Err(format!("Velocity.app not found at {}", bundle.display()));
        }
        let bundle = bundle
            .canonicalize()
            .unwrap_or(bundle);
        let mut bundle_uri = url::Url::from_file_path(&bundle)
            .map_err(|_| "Invalid app path for Dock".to_string())?
            .to_string();
        if !bundle_uri.ends_with('/') {
            bundle_uri.push('/');
        }

        let tmp_export = std::env::temp_dir().join(format!("velocity-dock-{}.plist", uuid::Uuid::new_v4()));
        let status = Command::new("defaults")
            .args(["export", "com.apple.dock"])
            .arg(&tmp_export)
            .status()
            .map_err(|e| format!("Failed to export Dock prefs: {e}"))?;
        if !status.success() {
            let _ = fs::remove_file(&tmp_export);
            return Err("Failed to export Dock preferences".into());
        }

        let mut root: Dictionary = plist::from_file(&tmp_export).map_err(|e| {
            let _ = fs::remove_file(&tmp_export);
            format!("Failed to parse Dock prefs: {e}")
        })?;
        let _ = fs::remove_file(&tmp_export);

        let mut apps: Vec<Value> = root
            .remove("persistent-apps")
            .and_then(|v| match v {
                Value::Array(a) => Some(a),
                _ => None,
            })
            .unwrap_or_default();

        let already = dock_already_keeps_velocity(&apps, &bundle_uri);
        if keep && already {
            return Ok(());
        }
        if !keep && !apps.iter().any(dock_tile_is_velocity) {
            return Ok(());
        }

        apps.retain(|t| !dock_tile_is_velocity(t));

        if keep {
            let book = macos_bookmark_for_app(&bundle)?;
            let mut file_data = Dictionary::new();
            file_data.insert(
                "_CFURLString".into(),
                Value::String(bundle_uri.clone()),
            );
            file_data.insert("_CFURLStringType".into(), Value::Integer(15.into()));

            let mut tile_data = Dictionary::new();
            tile_data.insert("book".into(), Value::Data(book));
            tile_data.insert(
                "bundle-identifier".into(),
                Value::String("com.inertiaux.velocity".into()),
            );
            tile_data.insert("dock-extra".into(), Value::Boolean(false));
            tile_data.insert("file-data".into(), Value::Dictionary(file_data));
            tile_data.insert("file-label".into(), Value::String("Velocity".into()));
            tile_data.insert("file-type".into(), Value::Integer(41.into()));
            tile_data.insert("is-beta".into(), Value::Boolean(false));

            let mut tile = Dictionary::new();
            let guid = (uuid::Uuid::new_v4().as_u128() % (u32::MAX as u128)) as u32;
            tile.insert("GUID".into(), Value::Integer((guid as i64).into()));
            tile.insert("tile-type".into(), Value::String("file-tile".into()));
            tile.insert("tile-data".into(), Value::Dictionary(tile_data));
            apps.push(Value::Dictionary(tile));
        }

        root.insert("persistent-apps".into(), Value::Array(apps));

        let tmp_import = std::env::temp_dir().join(format!("velocity-dock-in-{}.plist", uuid::Uuid::new_v4()));
        plist::to_file_binary(&tmp_import, &Value::Dictionary(root))
            .map_err(|e| format!("Failed to write Dock prefs: {e}"))?;
        let status = Command::new("defaults")
            .args(["import", "com.apple.dock"])
            .arg(&tmp_import)
            .status()
            .map_err(|e| {
                let _ = fs::remove_file(&tmp_import);
                format!("Failed to import Dock prefs: {e}")
            })?;
        let _ = fs::remove_file(&tmp_import);
        if !status.success() {
            return Err("Failed to import Dock preferences".into());
        }

        // Dock keeps persistent-apps in memory - relaunch so the tile appears.
        // (Unlike autohide toggles, this is a one-shot user action.)
        let _ = Command::new("killall").arg("Dock").status();
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = keep;
        Ok(())
    }
}

fn emit_open_preferences(app: &AppHandle) {
    let _ = app.emit("velocity://open-preferences", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = with_window_main(&window, |window| {
            let _ = window.show();
            let _ = window.set_visible_on_all_workspaces(true);
            macos_apply_space_overlay(window, true, true);
            let _ = window.set_focus();
        });
    }
}

#[cfg(target_os = "macos")]
fn install_macos_dock_menu() -> Result<(), String> {
    use muda::{ContextMenu, Menu, MenuItem};
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;

    let item = MenuItem::with_id("preferences", "Preferences…", true, None);
    let menu = Menu::new();
    menu.append(&item).map_err(|e| e.to_string())?;

    let mtm = MainThreadMarker::new().ok_or_else(|| "main thread required".to_string())?;
    let ns_app = NSApplication::sharedApplication(mtm);
    unsafe {
        let ns_menu = menu.ns_menu() as *mut AnyObject;
        // Undocumented AppKit API used by Electron for Dock context menus.
        let _: () = msg_send![&*ns_app, setDockMenu: ns_menu];
    }

    // Menu/Item are !Send; keep them alive for the process lifetime.
    std::mem::forget(menu);
    std::mem::forget(item);
    Ok(())
}

fn install_app_menu(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

    let preferences = MenuItemBuilder::with_id("preferences", "Preferences…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_submenu = SubmenuBuilder::new(app, "Velocity")
        .item(&preferences)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let menu = MenuBuilder::new(app).item(&app_submenu).build()?;
    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| {
        if event.id().as_ref() == "preferences" {
            emit_open_preferences(app);
        }
    });

    #[cfg(target_os = "macos")]
    {
        let _ = install_macos_dock_menu();
    }

    Ok(())
}

#[tauri::command]
fn launch_target(target: String) -> Result<(), String> {
    if target.starts_with("steam://") || target.starts_with("http://") || target.starts_with("https://")
    {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", &target])
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    let path = PathBuf::from(&target);
    #[cfg(target_os = "macos")]
    {
        if path.extension().and_then(|e| e.to_str()) == Some("app") || path.is_dir() {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &target])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(&path)
            .spawn()
            .or_else(|_| {
                std::process::Command::new("xdg-open")
                    .arg(&path)
                    .spawn()
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
fn resolve_app_icon(app: AppHandle, path: String) -> Result<AppPickResult, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Path does not exist".into());
    }
    let name = display_name_for_path(&p);
    #[cfg(target_os = "macos")]
    let icon_path = persist_macos_app_icon(&app, &p);
    #[cfg(not(target_os = "macos"))]
    let icon_path: Option<String> = None;

    // Optional tiny preview for immediate UI (disk path is source of truth)
    let icon_data_url = icon_path.as_ref().and_then(|ip| {
        let bytes = std::fs::read(ip).ok()?;
        if bytes.len() >= 80_000 {
            return None;
        }
        Some(format!("data:image/png;base64,{}", B64.encode(bytes)))
    });

    Ok(AppPickResult {
        path,
        name,
        icon_data_url,
        icon_path,
    })
}

#[tauri::command]
fn register_toggle_hotkey(
    app: AppHandle,
    hotkey: String,
    slot: tauri::State<'_, HotkeySlot>,
) -> Result<(), String> {
    let shortcut = parse_hotkey(&hotkey)?;

    // Drop any previous binding first (same or different key). Avoid stacking handlers.
    if let Ok(mut guard) = slot.lock() {
        if let Some(prev) = guard.take() {
            if let Ok(sc) = parse_hotkey(&prev) {
                let _ = app.global_shortcut().unregister(sc);
            }
        }
        // Also clear this exact shortcut in case a prior register failed mid-way.
        let _ = app.global_shortcut().unregister(shortcut);
        *guard = Some(hotkey.clone());
    }

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            let Some(ui) = app.try_state::<PhoneUiSlot>() else {
                return;
            };
            let Some(dock) = app.try_state::<DockSlot>() else {
                return;
            };
            let ui = ui.inner().clone();
            let dock = dock.inner().clone();
            // Run off the hotkey callback so the slide animation can play.
            thread::spawn(move || {
                let _ = run_toggle(&window, None, None, &dock, &ui);
            });
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Known Discord-family clients → (bundle filename, id, display name, sort rank).
/// Lower rank = preferred default when multiple are installed.
#[cfg(target_os = "macos")]
fn discord_family_known() -> &'static [(&'static str, &'static str, &'static str, u8)] {
    &[
        ("Discord.app", "discord", "Discord", 0),
        ("Vesktop.app", "vesktop", "Vesktop", 1),
        ("Discord Vencord.app", "discord-vencord", "Discord Vencord", 2),
        ("Vencord.app", "vencord", "Vencord", 3),
        ("Discord PTB.app", "discord-ptb", "Discord PTB", 4),
        ("Discord Canary.app", "discord-canary", "Discord Canary", 5),
        ("Discord Development.app", "discord-development", "Discord Development", 6),
        ("Equilotl.app", "equilotl", "Equilotl", 7),
        ("Equicord.app", "equicord", "Equicord", 8),
        ("Legcord.app", "legcord", "Legcord", 9),
        ("ArmCord.app", "armcord", "ArmCord", 10),
        ("Dorion.app", "dorion", "Dorion", 11),
    ]
}

#[cfg(target_os = "macos")]
fn classify_discord_bundle(file_name: &str) -> Option<(String, String, u8)> {
    let lower = file_name.to_lowercase();
    if !lower.ends_with(".app") {
        return None;
    }
    for (bundle, id, name, rank) in discord_family_known() {
        if file_name.eq_ignore_ascii_case(bundle) {
            return Some(((*id).into(), (*name).into(), *rank));
        }
    }
    // Catch renamed / niche builds (e.g. "Discord Vencord.app" already covered;
    // also "VencordHelper", custom Vesktop forks, etc.)
    let stem = lower.trim_end_matches(".app");
    let hit = [
        "discord", "vesktop", "vencord", "equicord", "equilotl", "legcord", "armcord", "dorion",
    ]
    .iter()
    .any(|k| stem.contains(k));
    if !hit {
        return None;
    }
    let name = display_name_for_path(&PathBuf::from(file_name));
    let id = format!(
        "discord-{}",
        stem
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .trim_matches('-')
    );
    Some((id, name, 50))
}

#[cfg(target_os = "macos")]
fn detect_discord_family_apps() -> Vec<(SuggestedApp, u8)> {
    let home = std::env::var("HOME").unwrap_or_default();
    let dirs = [
        PathBuf::from("/Applications"),
        PathBuf::from(format!("{home}/Applications")),
    ];
    let mut found: Vec<(SuggestedApp, u8)> = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(file_name) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let Some((id, name, rank)) = classify_discord_bundle(file_name) else {
                continue;
            };
            let Ok(canonical) = path.canonicalize() else {
                continue;
            };
            let key = canonical.to_string_lossy().to_string();
            if !seen_paths.insert(key.clone()) {
                continue;
            }
            let icon = extract_macos_icon(&path);
            found.push((
                SuggestedApp {
                    id,
                    family: "discord".into(),
                    name,
                    path: path.to_string_lossy().to_string(),
                    icon_data_url: icon,
                },
                rank,
            ));
        }
    }

    found.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.name.cmp(&b.0.name)));
    found
}

#[tauri::command]
fn detect_suggested_apps() -> Result<Vec<SuggestedApp>, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(detect_discord_family_apps()
            .into_iter()
            .map(|(app, _)| app)
            .collect())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn list_plugins(app: AppHandle) -> Result<Vec<PluginManifest>, String> {
    let mut plugins = Vec::new();
    // User plugins first so installs/updates override bundled examples with the same id.
    let user = plugins_dir(&app)?;
    collect_plugins_from(&user, &mut plugins);
    if let Some(bundled) = bundled_plugins_dir(&app) {
        collect_plugins_from(&bundled, &mut plugins);
    }
    Ok(plugins)
}

#[tauri::command]
fn get_plugin_entry(app: AppHandle, plugin_id: String) -> Result<String, String> {
    let plugins = list_plugins(app)?;
    let plugin = plugins
        .into_iter()
        .find(|p| p.id == plugin_id)
        .ok_or_else(|| format!("Plugin not found: {plugin_id}"))?;
    let base = PathBuf::from(plugin.path.ok_or("Missing plugin path")?);
    let entry = base.join(&plugin.entry);
    if !entry.exists() {
        return Err(format!("Entry not found: {}", entry.display()));
    }
    Ok(format!("file://{}", entry.to_string_lossy()))
}

#[tauri::command]
fn read_plugin_file(app: AppHandle, plugin_id: String, relative: String) -> Result<String, String> {
    let plugins = list_plugins(app)?;
    let plugin = plugins
        .into_iter()
        .find(|p| p.id == plugin_id)
        .ok_or_else(|| format!("Plugin not found: {plugin_id}"))?;
    let base = PathBuf::from(plugin.path.ok_or("Missing plugin path")?);
    let path = base.join(&relative);
    if !path.starts_with(&base) {
        return Err("Path escape blocked".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn install_plugin_from_path(app: AppHandle, source_path: String) -> Result<PluginManifest, String> {
    let path = PathBuf::from(&source_path);
    let (root, temp) = resolve_plugin_package(&path)?;
    let result = (|| {
        let manifest =
            read_manifest(&root).ok_or("Invalid plugin: missing velocity.plugin.json")?;
        if manifest.id.trim().is_empty() {
            return Err("Plugin manifest is missing id".into());
        }
        if manifest.name.trim().is_empty() {
            return Err("Plugin manifest is missing name".into());
        }
        let entry_path = root.join(&manifest.entry);
        if !entry_path.exists() {
            return Err(format!(
                "Entry not found: {} (check manifest.entry)",
                manifest.entry
            ));
        }
        let dest = plugins_dir(&app)?.join(&manifest.id);
        if dest.exists() {
            std::fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
        }
        copy_dir(&root, &dest)?;
        read_manifest(&dest).ok_or_else(|| "Failed to read installed plugin".into())
    })();
    if let Some(temp) = temp {
        let _ = std::fs::remove_dir_all(temp);
    }
    result
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let parent = PathBuf::from(&path);
        let dir = if parent.is_file() {
            parent.parent().unwrap_or(parent.as_path())
        } else {
            parent.as_path()
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim()
            .trim_start_matches('v')
            .split(|c: char| !c.is_ascii_digit())
            .filter(|p| !p.is_empty())
            .filter_map(|p| p.parse::<u64>().ok())
            .collect()
    };
    let a = parse(latest);
    let b = parse(current);
    if a.is_empty() || a == b {
        return false;
    }
    let len = a.len().max(b.len());
    for i in 0..len {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

fn evaluate_update_feed(current: &str, body: &str) -> Result<UpdateInfo, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("Invalid update feed: {e}"))?;
    let latest = json
        .get("version")
        .or_else(|| json.get("tag_name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    let available = !latest.is_empty() && version_is_newer(&latest, current);
    Ok(UpdateInfo {
        available,
        current_version: current.to_string(),
        latest_version: if latest.is_empty() {
            None
        } else {
            Some(latest)
        },
        release_url: json
            .get("html_url")
            .or_else(|| json.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        notes: json
            .get("notes")
            .or_else(|| json.get("body"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

#[tauri::command]
fn check_for_updates(app: AppHandle, feed_url: Option<String>) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();
    let primary = feed_url
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| DEFAULT_UPDATE_FEED.to_string());

    let mut urls = vec![primary.clone()];
    // When using the default (or empty → default), also try published fallbacks.
    if primary == DEFAULT_UPDATE_FEED {
        for fallback in FALLBACK_UPDATE_FEEDS {
            if !urls.iter().any(|u| u == fallback) {
                urls.push((*fallback).to_string());
            }
        }
    }

    let mut last_err = String::new();
    for url in urls {
        match ureq_get(&url) {
            Ok(body) => match evaluate_update_feed(&current, &body) {
                Ok(info) => return Ok(info),
                Err(e) => last_err = format!("{url}: {e}"),
            },
            Err(e) => last_err = format!("{url}: {e}"),
        }
    }
    Err(format!("Update check failed. {last_err}"))
}

#[cfg(test)]
mod update_tests {
    use super::{
        evaluate_update_feed, expand_plugin_repo_urls, github_raw_url, normalize_plugin_download_url,
        parse_github_target, parse_plugin_repo,
    };

    #[test]
    fn detects_newer_version() {
        let info = evaluate_update_feed(
            "0.1.0",
            r#"{"version":"0.1.1","url":"https://example.com","notes":"device polish"}"#,
        )
        .unwrap();
        assert!(info.available);
        assert_eq!(info.latest_version.as_deref(), Some("0.1.1"));
        assert_eq!(info.release_url.as_deref(), Some("https://example.com"));
        assert_eq!(info.notes.as_deref(), Some("device polish"));
    }

    #[test]
    fn no_update_when_same_version() {
        let info = evaluate_update_feed("0.1.1", r#"{"version":"0.1.1"}"#).unwrap();
        assert!(!info.available);
    }

    #[test]
    fn no_update_when_feed_is_older() {
        let info = evaluate_update_feed("0.1.2", r#"{"version":"0.1.1"}"#).unwrap();
        assert!(!info.available);
    }

    #[test]
    fn detects_semver_newer() {
        let info = evaluate_update_feed("0.1.1", r#"{"version":"0.1.2"}"#).unwrap();
        assert!(info.available);
        assert_eq!(info.latest_version.as_deref(), Some("0.1.2"));
    }

    #[test]
    fn accepts_github_style_tag() {
        let info = evaluate_update_feed(
            "0.1.0",
            r#"{"tag_name":"v0.1.1","html_url":"https://github.com/x/y/releases/tag/v0.1.1","body":"notes"}"#,
        )
        .unwrap();
        assert!(info.available);
        assert_eq!(info.latest_version.as_deref(), Some("0.1.1"));
        assert!(info.release_url.unwrap().contains("releases"));
    }

    #[test]
    fn parses_plugin_repo_feed() {
        let feed = parse_plugin_repo(
            r#"{
              "name":"Official",
              "plugins":[{
                "id":"com.example.hello",
                "name":"Hello",
                "version":"0.1.0",
                "downloadUrl":"https://example.com/hello.zip",
                "permissions":["network"]
              }]
            }"#,
        )
        .unwrap();
        assert_eq!(feed.name, "Official");
        assert_eq!(feed.plugins.len(), 1);
        assert_eq!(feed.plugins[0].id, "com.example.hello");
        assert_eq!(feed.plugins[0].download_url, "https://example.com/hello.zip");
    }

    #[test]
    fn parses_github_repo_and_blob_urls() {
        let root = parse_github_target("https://github.com/InertiaUX/hello-plugin").unwrap();
        assert_eq!(root.owner, "InertiaUX");
        assert_eq!(root.repo, "hello-plugin");
        assert_eq!(root.git_ref, "main");
        assert!(root.path.is_empty());

        let blob = parse_github_target(
            "https://github.com/InertiaUX/hello-plugin/blob/main/repo.json",
        )
        .unwrap();
        assert_eq!(blob.path, "repo.json");
        assert_eq!(
            github_raw_url(&blob),
            "https://raw.githubusercontent.com/InertiaUX/hello-plugin/main/repo.json"
        );
    }

    #[test]
    fn normalizes_github_download_to_archive() {
        let url = normalize_plugin_download_url("https://github.com/acme/my-plugin").unwrap();
        assert_eq!(
            url,
            "https://github.com/acme/my-plugin/archive/refs/heads/main.zip"
        );
    }

    #[test]
    fn expands_github_repo_feed_candidates() {
        let urls = expand_plugin_repo_urls("https://github.com/acme/plugins");
        assert!(urls.iter().any(|u| u.contains("repo.json")));
        assert!(urls
            .iter()
            .any(|u| u.ends_with("/velocity.plugin.json")));
    }

    #[test]
    fn accepts_github_download_url_in_feed() {
        let feed = parse_plugin_repo(
            r#"{
              "name":"GH",
              "plugins":[{
                "id":"com.acme.hello",
                "name":"Hello",
                "version":"0.1.0",
                "downloadUrl":"https://github.com/acme/hello"
              }]
            }"#,
        )
        .unwrap();
        assert_eq!(feed.plugins[0].download_url, "https://github.com/acme/hello");
    }
}

#[tauri::command]
fn start_oauth_listener(
    expected_state: String,
    slot: tauri::State<'_, OAuthSlot>,
) -> Result<u16, String> {
    {
        let mut guard = slot.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    let slot_clone = slot.inner().clone();
    let state_expected = expected_state;
    thread::spawn(move || {
        let server = match tiny_http::Server::http(format!("127.0.0.1:{OAUTH_PORT}")) {
            Ok(s) => s,
            Err(_) => return,
        };
        let request = match server.recv() {
            Ok(r) => r,
            Err(_) => return,
        };
        let url = request.url().to_string();
        let query = url.split('?').nth(1).unwrap_or("");
        let mut code = None;
        let mut error = None;
        let mut state = None;
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            let k = parts.next().unwrap_or("");
            let v = parts.next().unwrap_or("").to_string();
            match k {
                "code" => code = Some(urlencoding::decode(&v).unwrap_or_default().to_string()),
                "error" => error = Some(urlencoding::decode(&v).unwrap_or_default().to_string()),
                "state" => state = Some(urlencoding::decode(&v).unwrap_or_default().to_string()),
                _ => {}
            }
        }
        let ok = state.as_deref() == Some(state_expected.as_str()) || state.is_none();
        let html = if ok && code.is_some() {
            "<html><body style='font-family:system-ui;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh'><div><h1>Connected</h1><p>You can close this tab and return to Velocity.</p></div></body></html>"
        } else {
            "<html><body style='font-family:system-ui;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh'><div><h1>Auth failed</h1><p>Return to Velocity and try again.</p></div></body></html>"
        };
        let header =
            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
                .unwrap();
        let _ = request.respond(tiny_http::Response::from_string(html).with_header(header));
        if let Ok(mut guard) = slot_clone.lock() {
            *guard = Some(OAuthResult {
                code: if ok { code } else { None },
                error,
                state,
            });
        }
    });
    thread::sleep(Duration::from_millis(80));
    Ok(OAUTH_PORT)
}

#[tauri::command]
fn poll_oauth_result(slot: tauri::State<'_, OAuthSlot>) -> Result<Option<OAuthResult>, String> {
    let guard = slot.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_user_plugins_dir(app: AppHandle) -> Result<String, String> {
    Ok(plugins_dir(&app)?.to_string_lossy().to_string())
}

fn json_state_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("state");
    Ok(dir.join(format!("{safe}.json")))
}

/// Load durable JSON state (home layout, prefs). Source of truth vs localStorage.
#[tauri::command]
fn load_json_state(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = json_state_path(&app, &name)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(raw))
}

/// Atomically persist JSON state under app data.
#[tauri::command]
fn save_json_state(app: AppHandle, name: String, json: String) -> Result<(), String> {
    let path = json_state_path(&app, &name)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_json_state(app: AppHandle, name: String) -> Result<(), String> {
    let path = json_state_path(&app, &name)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Wipe prefs, home layout, cached icons/wallpapers, and close the in-app browser.
#[tauri::command]
fn factory_reset_velocity(app: AppHandle) -> Result<(), String> {
    let _ = browser_close(app.clone());
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    for name in ["state", "tile-icons", "wallpapers"] {
        let path = data.join(name);
        if path.exists() {
            std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }
    // Legacy loose state files (if any)
    if let Ok(entries) = std::fs::read_dir(&data) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("velocity-device") && n.ends_with(".json"))
            {
                let _ = std::fs::remove_file(path);
            }
        }
    }
    Ok(())
}

/// In-app browser webview - iPhone Safari UA so sites serve their mobile layout.
const BROWSER_WEBVIEW_LABEL: &str = "velocity-browser";
const MOBILE_SAFARI_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

fn browser_hide_webview(app: &AppHandle) -> Result<(), String> {
    if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
        wv.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn browser_close_webview(app: &AppHandle) -> Result<(), String> {
    if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Show (or create) the mobile browser webview and navigate to `url`.
#[tauri::command]
async fn browser_open_page(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Only http(s) pages can load in the browser".into());
    }
    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window missing".to_string())?;
    let w = width.max(40.0);
    let h = height.max(40.0);

    if let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) {
        wv.set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(LogicalSize::new(w, h))
            .map_err(|e| e.to_string())?;
        wv.navigate(parsed).map_err(|e| e.to_string())?;
        wv.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let app_nav = app.clone();
    let app_load = app.clone();
    let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(parsed))
        .user_agent(MOBILE_SAFARI_UA)
        .on_navigation(move |url| {
            let _ = app_nav.emit("browser://navigating", url.to_string());
            true
        })
        .on_page_load(move |_wv, payload| {
            let _ = app_load.emit("browser://page-loaded", payload.url().to_string());
        });
    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(w, h),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn browser_set_bounds(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Ok(());
    };
    wv.set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(width.max(40.0), height.max(40.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn browser_hide(app: AppHandle) -> Result<(), String> {
    browser_hide_webview(&app)
}

#[tauri::command]
fn browser_close(app: AppHandle) -> Result<(), String> {
    browser_close_webview(&app)
}

#[tauri::command]
fn browser_reload(app: AppHandle) -> Result<(), String> {
    let Some(wv) = app.get_webview(BROWSER_WEBVIEW_LABEL) else {
        return Ok(());
    };
    let current = wv.url().map_err(|e| e.to_string())?;
    wv.navigate(current).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperImport {
    pub path: String,
    /// Small preview data URL for settings swatches (optional).
    pub preview_data_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TileIconImport {
    /// Absolute path under app data - survives updates / localStorage compaction.
    path: String,
    icon_data_url: Option<String>,
}

fn tile_icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("tile-icons");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn new_tile_icon_dest(app: &AppHandle, ext: &str) -> Result<PathBuf, String> {
    let dir = tile_icons_dir(app)?;
    Ok(dir.join(format!(
        "icon-{}-{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        &uuid::Uuid::new_v4().to_string()[..8],
        ext
    )))
}

fn persist_data_url_as_tile_icon(app: &AppHandle, data_url: &str) -> Result<String, String> {
    let (mime, b64) = data_url
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
        .ok_or_else(|| "Invalid icon data URL".to_string())?;
    let bytes = B64.decode(b64.as_bytes()).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Empty icon data".into());
    }
    if bytes.len() > 2_500_000 {
        return Err("Icon too large to save".into());
    }
    let ext = if mime.contains("png") {
        "png"
    } else if mime.contains("webp") {
        "webp"
    } else if mime.contains("gif") {
        "gif"
    } else {
        "jpg"
    };
    let dest = new_tile_icon_dest(app, ext)?;
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    // Shrink oversized dumps (common with NSWorkspace icons)
    #[cfg(target_os = "macos")]
    if bytes.len() > 120_000 {
        let shrunk = dest.with_extension("sm.png");
        let status = std::process::Command::new("sips")
            .args([
                "-z",
                "128",
                "128",
                "-s",
                "format",
                "png",
                dest.to_str().ok_or("Invalid path")?,
                "--out",
                shrunk.to_str().ok_or("Invalid path")?,
            ])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() && shrunk.exists() {
            let _ = std::fs::remove_file(&dest);
            std::fs::rename(&shrunk, &dest).map_err(|e| e.to_string())?;
        }
    }

    let final_len = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    if final_len == 0 || final_len > 500_000 {
        let _ = std::fs::remove_file(&dest);
        return Err("Icon still too large after resize".into());
    }
    Ok(dest.to_string_lossy().to_string())
}

/// Import a user image (or extract from .app) as a durable tile icon file.
#[tauri::command]
fn import_tile_icon(app: AppHandle, path: String) -> Result<TileIconImport, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File not found".into());
    }

    // .app bundles - reuse icon extraction (also writes icon_path)
    if path.ends_with(".app") || p.extension().and_then(|e| e.to_str()) == Some("app") {
        let picked = resolve_app_icon(app, path)?;
        let icon_path = picked
            .icon_path
            .ok_or_else(|| "Could not read app icon".to_string())?;
        return Ok(TileIconImport {
            path: icon_path,
            icon_data_url: picked.icon_data_url,
        });
    }

    let dest = new_tile_icon_dest(&app, "png")?;

    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("sips")
            .args([
                "-z",
                "128",
                "128",
                "-s",
                "format",
                "png",
                path.as_str(),
                "--out",
                dest.to_str().ok_or("Invalid destination path")?,
            ])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() || !dest.exists() {
            let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
            if bytes.len() > 800_000 {
                return Err("Image too large. Try a smaller file.".into());
            }
            std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
        if bytes.len() > 800_000 {
            return Err("Image too large. Try a smaller file.".into());
        }
        std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    }

    let bytes = std::fs::read(&dest).map_err(|e| e.to_string())?;
    if bytes.len() > 400_000 {
        return Err("Icon still too large after resize.".into());
    }
    let preview = if bytes.len() < 80_000 {
        Some(format!("data:image/png;base64,{}", B64.encode(&bytes)))
    } else {
        None
    };
    Ok(TileIconImport {
        path: dest.to_string_lossy().to_string(),
        icon_data_url: preview,
    })
}

/// Persist a legacy inlined data-URL icon to disk (migration after updates).
#[tauri::command]
fn persist_tile_icon_data(app: AppHandle, data_url: String) -> Result<TileIconImport, String> {
    let path = persist_data_url_as_tile_icon(&app, &data_url)?;
    Ok(TileIconImport {
        path,
        icon_data_url: None,
    })
}

#[tauri::command]
fn import_wallpaper_image(app: AppHandle, path: String) -> Result<WallpaperImport, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File not found".into());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("wallpapers");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join("custom.jpg");

    // Resize/compress so we never blow localStorage quota. Prefer macOS `sips`.
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("sips")
            .args([
                "-Z",
                "1400",
                "-s",
                "format",
                "jpeg",
                "-s",
                "formatOptions",
                "70",
                path.as_str(),
                "--out",
                dest.to_str().ok_or("Invalid destination path")?,
            ])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() || !dest.exists() {
            // Fallback: copy raw if under 1.5MB
            let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
            if bytes.len() > 1_500_000 {
                return Err("Could not compress image. Try a smaller photo.".into());
            }
            std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
        if bytes.len() > 1_500_000 {
            return Err("Image too large (max 1.5MB). Try a smaller photo.".into());
        }
        std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    }

    let preview_bytes = std::fs::read(&dest).map_err(|e| e.to_string())?;
    let preview = if preview_bytes.len() < 350_000 {
        Some(format!(
            "data:image/jpeg;base64,{}",
            B64.encode(&preview_bytes)
        ))
    } else {
        None
    };

    Ok(WallpaperImport {
        path: dest.to_string_lossy().to_string(),
        preview_data_url: preview,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let oauth_slot: OAuthSlot = Arc::new(Mutex::new(None));
    let dock_slot: DockSlot = Arc::new(Mutex::new(DockState {
        previous_autohide: None,
        enforced: false,
    }));
    let hotkey_slot: HotkeySlot = Arc::new(Mutex::new(None));
    let phone_ui_slot: PhoneUiSlot = Arc::new(Mutex::new(PhoneUiState {
        corner: "bottom-right".into(),
        autohide_dock: false,
        always_on_top: false,
        animating: false,
        shown: true,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin({
            #[cfg(target_os = "macos")]
            {
                tauri_plugin_autostart::Builder::new()
                    .macos_launcher(tauri_plugin_autostart::MacosLauncher::LaunchAgent)
                    .build()
            }
            #[cfg(not(target_os = "macos"))]
            {
                tauri_plugin_autostart::Builder::new().build()
            }
        })
        .manage(oauth_slot)
        .manage(dock_slot.clone())
        .manage(hotkey_slot)
        .manage(phone_ui_slot)
        .invoke_handler(tauri::generate_handler![
            place_phone,
            set_always_on_top,
            show_phone,
            resize_phone,
            minimize_phone,
            restore_phone,
            toggle_phone,
            sync_phone_prefs,
            set_dock_autohide_while_active,
            set_show_in_dock,
            set_keep_in_dock,
            launch_target,
            resolve_app_icon,
            detect_suggested_apps,
            register_toggle_hotkey,
            list_plugins,
            get_plugin_entry,
            read_plugin_file,
            install_plugin_from_path,
            inspect_plugin_package,
            fetch_plugin_repo,
            download_plugin_package,
            reveal_in_finder,
            check_for_updates,
            start_oauth_listener,
            poll_oauth_result,
            app_version,
            get_user_plugins_dir,
            import_wallpaper_image,
            import_tile_icon,
            persist_tile_icon_data,
            load_json_state,
            save_json_state,
            clear_json_state,
            factory_reset_velocity,
            browser_open_page,
            browser_set_bounds,
            browser_hide,
            browser_close,
            browser_reload
        ])
        .setup(|app| {
            // If a previous session crashed mid-autohide, put the Dock back.
            #[cfg(target_os = "macos")]
            if let Some(prev) = take_dock_restore_marker(app.handle()) {
                macos_dock_autohide_restore(prev);
            }
            run_on_main(app.handle(), || macos_set_presentation_dock_autohide(false));

            install_app_menu(&app.handle().clone())?;
            if let Some(window) = app.get_webview_window("main") {
                position_phone(&window, "bottom-right");
                let _ = window.set_visible_on_all_workspaces(true);
                // NSPanel conversion only sticks for fullscreen Spaces after the app
                // has been Accessory at least once (Tauri / AppKit quirk).
                #[cfg(target_os = "macos")]
                {
                    let _ = app
                        .handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
                let _ = window.show();
                macos_apply_space_overlay(&window, true, true);
                #[cfg(target_os = "macos")]
                {
                    let _ = app
                        .handle()
                        .set_activation_policy(tauri::ActivationPolicy::Regular);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Velocity")
        .run(move |app, event| {
            match event {
                // Hiding the last window (Shift+Tab minimize) requests exit with
                // code=None on macOS - especially when the Dock icon is hidden.
                // Keep the process alive so the hotkey can show the phone again.
                // Explicit Quit (⌘Q / menu) exits with Some(code).
                tauri::RunEvent::ExitRequested { api, code, .. } => {
                    if code.is_none() {
                        api.prevent_exit();
                    } else {
                        restore_dock_on_shutdown(app, &dock_slot);
                    }
                }
                tauri::RunEvent::Exit => {
                    restore_dock_on_shutdown(app, &dock_slot);
                }
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::CloseRequested { api, .. },
                    ..
                } if label == "main" => {
                    // Never destroy the phone window - treat close as hide/toggle-off.
                    api.prevent_close();
                    if let Some(window) = app.get_webview_window("main") {
                        if let (Some(ui), Some(dock)) = (
                            app.try_state::<PhoneUiSlot>(),
                            app.try_state::<DockSlot>(),
                        ) {
                            let ui = ui.inner().clone();
                            let dock = dock.inner().clone();
                            thread::spawn(move || {
                                let _ = run_minimize(&window, &dock, &ui);
                            });
                        } else {
                            let _ = window.hide();
                        }
                    }
                }
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Destroyed,
                    ..
                } if label == "main" => {
                    restore_dock_on_shutdown(app, &dock_slot);
                }
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Focused(true),
                    ..
                } if label == "main" => {
                    // Re-apply presentation autohide when the phone becomes key again.
                    if let Ok(guard) = dock_slot.lock() {
                        if guard.enforced {
                            drop(guard);
                            run_on_main(app, || macos_set_presentation_dock_autohide(true));
                        }
                    }
                }
                _ => {}
            }
        });
}
