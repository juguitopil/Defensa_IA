const status = document.getElementById("status");
const button = document.getElementById("open");

function note(text) {
  if (status) status.textContent = text;
}

async function inject(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

button?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  try {
    if (tab?.id && /https:\/\/mail\.google\.com\//i.test(url)) {
      await inject(tab.id);
      await chrome.tabs.reload(tab.id);
      note("Recargué Gmail. Abre un correo: el panel sale a la derecha.");
      return;
    }
    const created = await chrome.tabs.create({ url: "https://mail.google.com/mail/u/0/#inbox" });
    if (created.id) {
      const once = (tabId, info) => {
        if (tabId !== created.id || info.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(once);
        inject(tabId).catch(() => {});
      };
      chrome.tabs.onUpdated.addListener(once);
    }
    note("Abrí Gmail. Entra a un correo para ver la nota.");
  } catch (error) {
    note("Brave tiene que permitir Sello en mail.google.com. En el icono de la extensión, elige Permitir en este sitio.");
    console.error(error);
  }
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  const url = tab?.url || "";
  if (/https:\/\/mail\.google\.com\//i.test(url)) {
    note("Estás en Gmail. Pulsa el botón y luego abre un correo.");
  }
});
