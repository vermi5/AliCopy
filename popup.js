async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) throw new Error("No active tab URL");
  return tab.url;
}

/**
 * Returns a "generic" URL:
 * - Removes query string (?...) and fragment (#...)
 * - Normalizes AliExpress domains to https://www.aliexpress.com/...
 * - For AliExpress item links:
 *   - If the path contains ".html", trims the path to end at ".html"
 *   - If the path does NOT contain ".html", tries to reduce to a stable "/item/<id>.html" form
 *     when an item ID can be extracted.
 */
function toGenericUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    // If it's not a valid URL, return as-is.
    return rawUrl;
  }

  // Always drop tracking parameters and in-page anchors.
  u.search = "";
  u.hash = "";

  const host = u.hostname.toLowerCase();
  const isAli = host.endsWith("aliexpress.com") || host.endsWith("aliexpress.us") || host.includes("aliexpress.");

  if (!isAli) {
    return u.toString();
  }

  // Normalize AliExpress domain (e.g., es.aliexpress.com -> www.aliexpress.com).
  u.protocol = "https:";
  u.hostname = "www.aliexpress.com";

  const pathLower = u.pathname.toLowerCase();

  // Case 1: Already an .html page -> trim path to end at .html.
  const htmlIdx = pathLower.indexOf(".html");
  if (htmlIdx !== -1) {
    u.pathname = u.pathname.slice(0, htmlIdx + 5);
    return u.toString();
  }

  // Case 2: No .html in path.
  // Try to extract an AliExpress item ID and rebuild a stable item URL.
  // Common forms include:
  // - /item/1005005952528890.html (ideal, but handled above)
  // - /item/1005005952528890 (no .html in some variants)
  // - /i/1005005952528890 (occasionally seen)
  // - App/share links that still contain the numeric ID somewhere
  const itemIdMatch =
    u.pathname.match(/\/item\/(\d{8,})/i) ||
    u.pathname.match(/\/i\/(\d{8,})/i) ||
    rawUrl.match(/(?:item\/|\/i\/)(\d{8,})/i) ||
    rawUrl.match(/(\d{8,})/); // fallback: any long numeric sequence

  if (itemIdMatch && itemIdMatch[1]) {
    const itemId = itemIdMatch[1];
    u.pathname = `/item/${itemId}.html`;
  }

  return u.toString();
}

async function copyText(text) {
  // navigator.clipboard works in extension pages (popup) with user gesture.
  await navigator.clipboard.writeText(text);
}

(async () => {
  const statusEl = document.getElementById("status");
  const urlEl = document.getElementById("url");

  try {
    const raw = await getActiveTabUrl();
    const clean = toGenericUrl(raw);

    await copyText(clean);

    statusEl.textContent = "✅ Copied";
    statusEl.className = "ok";
    urlEl.textContent = clean;

    // Auto-close popup after a short delay.
    setTimeout(() => window.close(), 900);
  } catch (e) {
    statusEl.textContent = "❌ Copy failed";
    statusEl.className = "err";
    urlEl.textContent = String(e?.message || e);
  }
})();
