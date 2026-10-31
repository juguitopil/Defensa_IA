const API = "http://localhost:5080";
const selectExtension = document.querySelector("#extension");
const textoPermisos = document.querySelector("#permisos");
const estado = document.querySelector("#estado");
const agente = document.querySelector("#agente");
const boton = document.querySelector("#enviar");
const botonRevisar = document.querySelector("#revisar");
let instaladas = [];

function mostrarPermisos() {
  const extension = instaladas.find((item) => item.id === selectExtension.value);
  const permisos = extension ? permisosDeExtension(extension) : [];
  textoPermisos.textContent = permisos.length
    ? permisos.join(", ")
    : "Esta extensión no declara permisos en el manifiesto.";
}

function textoAgente(resultado) {
  if (!resultado) return "";
  if (resultado.error) return resultado.error;
  const revisiones = resultado.revisiones || [];
  const contar = (accion) => revisiones.filter((item) => item.accion === accion).length;
  const partes = [];
  const registradas = contar("registrada");
  const nuevas = contar("nueva_version");
  const iguales = contar("sin_cambios");
  const sinPermisos = contar("sin_permisos");
  const errores = contar("error");
  if (registradas) partes.push(`${registradas} registrada${registradas === 1 ? "" : "s"}`);
  if (nuevas) partes.push(`${nuevas} con versión nueva`);
  if (iguales) partes.push(`${iguales} sin cambios`);
  if (sinPermisos) partes.push(`${sinPermisos} sin permisos`);
  if (errores) partes.push(`${errores} con error`);
  let texto = partes.length ? `Revisión: ${partes.join(", ")}.` : "No había otras extensiones.";
  const pendientes = revisiones.filter((item) => item.aplicacionId && item.funcionConfirmada === false && item.accion !== "error");
  if (pendientes.length === 1) texto += ` Falta confirmar la función de ${pendientes[0].nombre}.`;
  else if (pendientes.length > 1) texto += ` Falta confirmar la función de ${pendientes.map((item) => item.nombre).join(", ")}.`;
  const ausentes = resultado.yaNoInstaladas || [];
  if (ausentes.length) texto += ` Ya no están instaladas: ${ausentes.join(", ")}.`;
  return texto;
}

chrome.management.getAll((todas) => {
  instaladas = todas
    .filter((item) => item.id !== chrome.runtime.id && item.type === "extension")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (!instaladas.length) {
    selectExtension.replaceChildren();
    const opcion = document.createElement("option");
    opcion.textContent = "No hay otras extensiones";
    selectExtension.append(opcion);
    boton.disabled = true;
    return;
  }

  selectExtension.replaceChildren();
  for (const item of instaladas) {
    const opcion = document.createElement("option");
    opcion.value = item.id;
    opcion.textContent = item.name;
    selectExtension.append(opcion);
  }
  mostrarPermisos();
});

selectExtension.addEventListener("change", mostrarPermisos);

botonRevisar.addEventListener("click", async () => {
  botonRevisar.disabled = true;
  agente.textContent = "Revisando las extensiones instaladas…";
  try {
    const resultado = await chrome.runtime.sendMessage({ tipo: "revisar" });
    agente.textContent = textoAgente(resultado);
  } catch {
    agente.textContent = "No se pudo hablar con el agente de la extensión.";
  }
  botonRevisar.disabled = false;
});

chrome.storage.local.get("ultimaRevision", (guardado) => {
  if (guardado.ultimaRevision) agente.textContent = textoAgente(guardado.ultimaRevision);
});

boton.addEventListener("click", async () => {
  const extension = instaladas.find((item) => item.id === selectExtension.value);
  if (!extension) return;
  const permisos = permisosDeExtension(extension);
  if (!permisos.length) {
    estado.textContent = "No hay permisos que analizar.";
    return;
  }

  boton.disabled = true;
  estado.textContent = "Enviando…";
  try {
    const respuesta = await fetch(`${API}/api/importaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: extension.name,
        descripcion: extension.description,
        desarrollador: extension.homepageUrl || "",
        version: extension.version,
        funcionPrincipal: document.querySelector("#funcion").value,
        origenId: extension.id,
        permisos
      })
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      estado.textContent = cuerpo.title || "No se pudo analizar.";
      boton.disabled = false;
      return;
    }
    const ultima = cuerpo.versiones[cuerpo.versiones.length - 1];
    estado.replaceChildren();
    estado.append(`Puntuación ${ultima.analisis.puntuacion}/100. `);
    const enlace = document.createElement("a");
    enlace.href = `${API}/#/aplicaciones/${cuerpo.id}`;
    enlace.target = "_blank";
    enlace.textContent = "Abrir informe";
    estado.append(enlace);
  } catch {
    estado.textContent = "Permission Guardian no responde en localhost:5080.";
  }
  boton.disabled = false;
});
