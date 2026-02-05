async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) throw new Error("No active tab URL");
  return tab.url;
}

function toGenericUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  u.search = "";
  u.hash = "";

  const host = u.hostname.toLowerCase();
  const isAli = host.includes("aliexpress.");

  if (!isAli) return u.toString();

  u.protocol = "https:";
  u.hostname = "www.aliexpress.com";

  const pathLower = u.pathname.toLowerCase();
  const htmlIdx = pathLower.indexOf(".html");
  if (htmlIdx !== -1) {
    u.pathname = u.pathname.slice(0, htmlIdx + 5);
    return u.toString();
  }

  const itemIdMatch =
    u.pathname.match(/\/item\/(\d{8,})/i) ||
    u.pathname.match(/\/i\/(\d{8,})/i) ||
    rawUrl.match(/(?:item\/|\/i\/)(\d{8,})/i) ||
    rawUrl.match(/(\d{8,})/);

  if (itemIdMatch && itemIdMatch[1]) {
    const itemId = itemIdMatch[1];
    u.pathname = `/item/${itemId}.html`;
  }

  return u.toString();
}

async function copyText(text) {
  // Must be triggered by a user gesture (button click) to avoid focus issues in Edge.
  await navigator.clipboard.writeText(text);
}

function setStatus(ok, msg, url = "") {
  const statusEl = document.getElementById("status");
  const urlEl = document.getElementById("url");
  statusEl.textContent = msg;
  statusEl.className = ok ? "ok" : "err";
  urlEl.textContent = url;
}

document.addEventListener("DOMContentLoaded", () => {
  // Try to keep popup focused
  window.focus();

  const btn = document.getElementById("copyBtn");
  btn.addEventListener("click", async () => {
    try {
      window.focus();

      const raw = await getActiveTabUrl();
      const clean = toGenericUrl(raw);

      await copyText(clean);

      setStatus(true, "✅ Copied", clean);
      setTimeout(() => window.close(), 900);
    } catch (e) {
      setStatus(false, "❌ Copy failed: " + (e?.message || e), "");
    }
  });
});