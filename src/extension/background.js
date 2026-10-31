function isGmail(url) {
  return typeof url === "string" && /^https:\/\/mail\.google\.com\//i.test(url);
}

async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch {
    /* La pestaña aún no es Gmail o Brave pide permiso del sitio. */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  /* Sello no guarda el correo. El análisis corre en la pestaña de Gmail. */
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && isGmail(tab.url)) {
    void inject(tabId);
  }
});
