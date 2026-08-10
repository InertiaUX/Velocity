import { useDeviceStore, DEFAULT_HOME_PAGE_ID } from "../store/deviceStore";
import { browserClose } from "./mobileBrowser";

/** Close apps, leave edit mode, return home, reload webview. Prefs stay. */
export async function respringVelocity(): Promise<void> {
  const store = useDeviceStore.getState();
  const homeId =
    store.homePages.find((p) => p.kind === "home")?.id ?? DEFAULT_HOME_PAGE_ID;

  store.setEditingHome(false);
  store.openApp(null);
  store.setBrowserLandscape(false);
  store.setBrowserUrl("about:home");
  store.setActivePageId(homeId);
  store.setKbFocusVisible(false);
  store.setKbFocusIndex(0);
  store.setPhoneVisible(true);

  try {
    await browserClose();
  } catch {
    /* no browser session */
  }

  // Let state flush to disk before the reload tears down the page.
  await new Promise((r) => window.setTimeout(r, 80));
  window.location.reload();
}
