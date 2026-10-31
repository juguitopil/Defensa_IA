importScripts("permisos.js");

const API = "http://localhost:5080";
let enCurso = null;

function revisar() {
  if (enCurso) return enCurso;
  enCurso = revisarAhora().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function revisarAhora() {
  const todas = await chrome.management.getAll();
  const extensiones = todas
    .filter((item) => item.id !== chrome.runtime.id && item.type === "extension")
    .map((item) => ({
      origenId: item.id,
      nombre: item.name,
      descripcion: item.description || "",
      desarrollador: item.homepageUrl || "",
      version: item.version,
      permisos: permisosDeExtension(item)
    }));

  let resultado;
  try {
    const respuesta = await fetch(`${API}/api/agente/reevaluar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensiones })
    });
    const cuerpo = await respuesta.json();
    resultado = respuesta.ok ? cuerpo : { error: cuerpo.title || "No se pudo revisar." };
  } catch {
    resultado = { error: "Permission Guardian no responde en localhost:5080." };
  }

  await chrome.storage.local.set({
    ultimaRevision: { ...resultado, fechaLocal: new Date().toISOString() }
  });
  return resultado;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("revisar", { periodInMinutes: 30 });
  revisar();
});

chrome.runtime.onStartup.addListener(() => {
  revisar();
});

chrome.alarms.onAlarm.addListener((alarma) => {
  if (alarma.name === "revisar") revisar();
});

chrome.management.onInstalled.addListener(() => revisar());
chrome.management.onUninstalled.addListener(() => revisar());

chrome.runtime.onMessage.addListener((mensaje, _emisor, responder) => {
  if (mensaje?.tipo !== "revisar") return;
  revisar().then(responder);
  return true;
});
