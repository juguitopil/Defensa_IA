const contenido = document.querySelector("#contenido");

const api = {
  async pedir(url, opciones = {}) {
    const respuesta = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opciones
    });
    if (!respuesta.ok) {
      let mensaje = "No se pudo completar la operación.";
      try {
        const problema = await respuesta.json();
        mensaje = problema.title || problema.detail || mensaje;
      } catch {
        /* La respuesta no traía JSON. */
      }
      throw new Error(mensaje);
    }
    return respuesta.status === 204 ? null : respuesta.json();
  },
  get(url) { return this.pedir(url); },
  post(url, cuerpo) {
    return this.pedir(url, { method: "POST", body: JSON.stringify(cuerpo) });
  }
};

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function fecha(iso) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function puntos(numero) {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(numero);
}

function insignia(tono, texto) {
  return `<span class="insignia" data-tono="${esc(tono)}">${esc(texto)}</span>`;
}

function anillo(puntuacion, nivel, etiqueta) {
  const tonos = { Bajo: "#1f6b45", Medio: "#8a5a10", Alto: "#b4532a", Critico: "#8f2430" };
  return `
    <div class="anillo" style="--valor:${Number(puntuacion)};--tono:${tonos[nivel] || "#1c1915"}" role="img" aria-label="${esc(puntuacion)} de 100, ${esc(etiqueta)}">
      <div><strong>${esc(puntuacion)}</strong><span>/100</span></div>
    </div>`;
}

function marcarNavegacion(ruta) {
  document.querySelectorAll("nav a").forEach((enlace) => {
    enlace.setAttribute("aria-current", enlace.dataset.ruta === ruta ? "page" : "false");
    if (enlace.getAttribute("aria-current") === "false") enlace.removeAttribute("aria-current");
  });
}

function pintar(html) {
  contenido.innerHTML = html;
  contenido.focus();
}

function errorVista(error) {
  pintar(`<p class="aviso error" role="alert">${esc(error.message)}</p>`);
}

async function enrutar() {
  const partes = (location.hash.replace(/^#/, "") || "/aplicaciones").split("/").filter(Boolean);
  const seccion = partes[0];
  marcarNavegacion(seccion === "aplicaciones" && partes.length === 1 ? "aplicaciones" : seccion);
  contenido.innerHTML = `<p class="suave">Cargando…</p>`;
  try {
    if (seccion === "registrar") return await vistaRegistrar();
    if (seccion === "historial") return await vistaHistorial();
    if (seccion === "catalogo") return await vistaCatalogo();
    if (seccion === "aplicaciones" && partes[1]) return await vistaDetalle(Number(partes[1]));
    marcarNavegacion("aplicaciones");
    return await vistaInicio();
  } catch (error) {
    errorVista(error);
  }
}

async function vistaInicio() {
  const aplicaciones = await api.get("/api/aplicaciones");
  const sinConfirmar = aplicaciones.filter((app) => !app.funcionConfirmada).length;
  const avisoAgente = sinConfirmar === 0 ? "" : `<p class="aviso">${sinConfirmar === 1
    ? "Hay una extensión registrada por el agente sin una función confirmada. Ábrela y confirma qué promete hacer."
    : `Hay ${sinConfirmar} extensiones registradas por el agente sin una función confirmada. Ábrelas y confirma qué prometen hacer.`}</p>`;
  const tarjetas = aplicaciones.map((app) => `
    <a class="tarjeta" href="#/aplicaciones/${app.id}">
      <header>
        <div>
          <h2>${esc(app.nombre)}</h2>
          <p class="meta">${esc(app.funcionTitulo)} · v${esc(app.versionActual)}</p>
          ${app.funcionConfirmada ? "" : `<p class="meta">Función sin confirmar</p>`}
        </div>
        <div class="puntos-grandes" style="color:${tono(app.nivelRiesgo)}">${esc(app.puntuacion)}<span>/100</span></div>
      </header>
      <p class="suave">${esc(app.descripcion)}</p>
      <div class="entre">
        ${insignia(app.nivelRiesgo, app.nivelEtiqueta)}
        ${app.funcionConfirmada ? "" : insignia("Revisar", "Confirmar función")}
        <span class="meta">${app.alertas} ${app.alertas === 1 ? "alerta" : "alertas"}${app.cambioImportante ? " · cambio" : ""}</span>
      </div>
    </a>`).join("");

  pintar(`
    <section class="introduccion">
      <p class="ceja">Decisiones antes de instalar</p>
      <h1>¿Lo que pide se parece a lo que promete?</h1>
      <p>Permission Guardian compara la función declarada de una aplicación con los permisos que solicita. La extensión revisa lo instalado y vuelve a evaluar lo ya guardado. La puntuación sale de las reglas.</p>
    </section>
    ${avisoAgente}
    ${aplicaciones.length ? `<div class="rejilla">${tarjetas}</div>` : `<div class="panel vacio"><p>Todavía no hay aplicaciones. <a href="#/registrar">Registra la primera</a>.</p></div>`}
  `);
}

async function vistaDetalle(id) {
  const [app, permisos, metodologia, perfiles] = await Promise.all([
    api.get(`/api/aplicaciones/${id}`),
    api.get("/api/permisos"),
    api.get("/api/metodologia"),
    api.get("/api/perfiles")
  ]);
  let actual = app.versiones[app.versiones.length - 1];
  const opcionesFuncion = perfiles.map((perfil) =>
    `<option value="${esc(perfil.clave)}" ${perfil.clave === app.funcionPrincipal ? "selected" : ""}>${esc(perfil.titulo)}</option>`).join("");
  const revision = app.fechaUltimaRevision ? ` · el agente la revisó el ${fecha(app.fechaUltimaRevision)}` : "";

  pintar(`
    <p><a class="volver" href="#/aplicaciones">← Aplicaciones</a></p>
    <header class="entre">
      <div>
        <p class="ceja">${esc(app.categoria)} · ${esc(app.desarrollador)}</p>
        <h1>${esc(app.nombre)}</h1>
        <p class="bajada">${esc(app.descripcion)}</p>
        <p class="meta">Función: ${esc(app.funcionTitulo)}${app.funcionConfirmada ? "" : " · sin confirmar"}${revision}</p>
      </div>
    </header>
    ${app.funcionConfirmada ? "" : `
    <section class="aviso" id="caja-funcion">
      <p>El agente la registró sin una función confirmada. Mientras figure como «${esc(app.funcionTitulo)}», un permiso amplio cuenta como desajuste. Confirma qué promete hacer para volver a evaluar.</p>
      <form id="form-funcion">
        <label>Función que declara
          <select name="funcionPrincipal">${opcionesFuncion}</select>
        </label>
        <button type="submit">Confirmar función y volver a evaluar</button>
        <p id="error-funcion" class="aviso error" hidden></p>
      </form>
    </section>`}
    <div id="informe"></div>
    <section class="panel" style="padding:18px;margin-top:18px">
      <h2>Comparar versiones</h2>
      <div id="comparar"></div>
    </section>
    <details>
      <summary>Registrar otra versión</summary>
      <form id="nueva-version" class="formulario" style="margin-top:16px">
        <div>
          <label>Versión <input name="version" required placeholder="2.1"></label>
          <button type="submit">Analizar versión</button>
          <p id="error-version" class="aviso error" hidden></p>
        </div>
        <div id="checks-version"></div>
      </form>
    </details>
    <details>
      <summary>Cómo se calcula la puntuación</summary>
      <p>${esc(metodologia.texto)}</p>
    </details>
  `);

  const checks = document.querySelector("#checks-version");
  checks.append(listaPermisos(permisos, new Set(actual.permisos)));
  pintarInforme(app, actual);

  document.querySelector("#informe").addEventListener("change", (evento) => {
    if (evento.target.name !== "versionVista") return;
    actual = app.versiones.find((v) => String(v.id) === evento.target.value);
    pintarInforme(app, actual);
  });

  if (app.versiones.length >= 2) {
    const origen = app.versiones[0];
    const destino = app.versiones[app.versiones.length - 1];
    cargarComparacion(app.id, origen.id, destino.id, app.versiones);
  } else {
    document.querySelector("#comparar").innerHTML = `<p class="suave">Cuando registres otra versión, aquí verás qué permisos cambiaron.</p>`;
  }

  document.querySelector("#nueva-version").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const boton = form.querySelector("button");
    const aviso = document.querySelector("#error-version");
    aviso.hidden = true;
    boton.disabled = true;
    try {
      await api.post(`/api/aplicaciones/${app.id}/versiones`, {
        version: new FormData(form).get("version"),
        permisos: permisosMarcados(form)
      });
      location.hash = `#/aplicaciones/${app.id}`;
      enrutar();
    } catch (error) {
      aviso.hidden = false;
      aviso.textContent = error.message;
      boton.disabled = false;
    }
  });

  const formFuncion = document.querySelector("#form-funcion");
  if (formFuncion) {
    formFuncion.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const boton = formFuncion.querySelector("button");
      const aviso = document.querySelector("#error-funcion");
      aviso.hidden = true;
      boton.disabled = true;
      try {
        await api.post(`/api/aplicaciones/${app.id}/funcion`, {
          funcionPrincipal: new FormData(formFuncion).get("funcionPrincipal")
        });
        enrutar();
      } catch (error) {
        aviso.hidden = false;
        aviso.textContent = error.message;
        boton.disabled = false;
      }
    });
  }
}

function pintarInforme(app, version) {
  const analisis = version.analisis;
  const opciones = app.versiones.map((v) =>
    `<option value="${v.id}" ${v.id === version.id ? "selected" : ""}>Versión ${esc(v.numero)}</option>`).join("");
  const hallazgos = analisis.hallazgos.map((h) => `
    <article class="permiso">
      <header>
        <h3>${esc(h.nombre)}</h3>
        <div class="etiquetas">
          ${insignia(h.nivelRiesgo, h.nivelEtiqueta)}
          ${insignia(h.coherencia, h.coherenciaEtiqueta)}
          ${h.esCambio ? insignia("cambio", "Nuevo") : ""}
        </div>
      </header>
      <p>${esc(h.evidencia)}</p>
      <p class="aporte">Aporte ${puntos(h.aporte)} · ${esc(h.recomendacion)}</p>
    </article>`).join("");

  document.querySelector("#informe").innerHTML = `
    ${analisis.cambioImportante ? `<p class="aviso">Cambio importante respecto de la versión anterior. Abajo puedes ver qué permisos se añadieron.</p>` : ""}
    <div class="entre">
      <label>Versión analizada
        <select name="versionVista">${opciones}</select>
      </label>
      <p class="meta">${fecha(analisis.fecha)} · ${analisis.fuenteExplicacion === "ia" ? "Redactado con modelo de lenguaje" : "Explicación del motor de reglas"}</p>
    </div>
    <section class="informe">
      ${anillo(analisis.puntuacion, analisis.nivelRiesgo, analisis.nivelEtiqueta)}
      <div>
        <h2 class="nivel">${esc(analisis.nivelEtiqueta)}</h2>
        <p>${esc(analisis.explicacion)}</p>
        ${analisis.advertenciaIa ? `<p class="aviso">${esc(analisis.advertenciaIa)}</p>` : ""}
        ${analisis.fuenteExplicacion === "ia" ? `<p class="suave">${esc(analisis.explicacionReglas)}</p>` : ""}
        <p class="recomendacion"><strong>Recomendación. </strong>${esc(analisis.recomendacion)}</p>
      </div>
    </section>
    <h2>Permisos</h2>
    <div class="lista">${hallazgos}</div>
  `;
}

async function cargarComparacion(aplicacionId, origenId, destinoId, versiones) {
  const caja = document.querySelector("#comparar");
  const ticket = ++ticketComparacion;
  caja.innerHTML = `<p class="suave">Comparando…</p>`;
  try {
    const comparacion = await api.get(`/api/aplicaciones/${aplicacionId}/comparar?origen=${origenId}&destino=${destinoId}`);
    if (ticket !== ticketComparacion) return;
    const opciones = (seleccion) => versiones.map((v) =>
      `<option value="${v.id}" ${v.id === seleccion ? "selected" : ""}>${esc(v.numero)}</option>`).join("");
    caja.innerHTML = `
      <form class="entre" id="form-comparar">
        <label>Desde <select name="origen">${opciones(comparacion.origen.id)}</select></label>
        <label>Hasta <select name="destino">${opciones(comparacion.destino.id)}</select></label>
      </form>
      <p class="${comparacion.cambioImportante ? "aviso" : "aviso calmo"}">${esc(comparacion.explicacion)}</p>
      <div class="columnas">
        ${columna(`Versión ${comparacion.origen.numero}`, comparacion.origen.nivelRiesgo, comparacion.origen.nivelEtiqueta, comparacion.filas.filter((f) => f.estado !== "nuevo"), false)}
        ${columna(`Versión ${comparacion.destino.numero}`, comparacion.destino.nivelRiesgo, comparacion.destino.nivelEtiqueta, comparacion.filas.filter((f) => f.estado !== "retirado"), true)}
      </div>`;
    caja.querySelector("#form-comparar").addEventListener("change", () => {
      const datos = new FormData(caja.querySelector("#form-comparar"));
      cargarComparacion(aplicacionId, datos.get("origen"), datos.get("destino"), versiones);
    });
  } catch (error) {
    if (ticket !== ticketComparacion) return;
    caja.innerHTML = `<p class="aviso error">${esc(error.message)}</p>`;
  }
}

let ticketComparacion = 0;

function columna(titulo, nivel, etiqueta, filas, destino) {
  const items = filas.map((fila) => {
    const nueva = destino && fila.estado === "nuevo";
    const sensible = fila.nivelRiesgo === "Alto" || fila.nivelRiesgo === "Critico";
    return `<li class="${esc(fila.estado)}"><span>${esc(fila.nombre)}</span>${nueva && sensible ? insignia("cambio", "Nueva alerta") : ""}</li>`;
  }).join("");
  return `
    <section class="panel columna">
      <h3>${esc(titulo)} ${insignia(nivel, etiqueta)}</h3>
      <ul>${items || "<li>Sin permisos</li>"}</ul>
    </section>`;
}

async function vistaRegistrar() {
  const [perfiles, permisos] = await Promise.all([
    api.get("/api/perfiles"),
    api.get("/api/permisos")
  ]);
  pintar(`
    <section class="introduccion">
      <p class="ceja">Nuevo análisis</p>
      <h1>Registrar una aplicación</h1>
      <p>Describe lo que dice hacer y marca los permisos que solicita. El informe se guarda; no se instala nada.</p>
    </section>
    <form id="alta" class="formulario">
      <div class="panel" style="padding:18px">
        <label>Nombre <input name="nombre" required minlength="2" maxlength="160" placeholder="Photo Editor"></label>
        <label>Descripción <textarea name="descripcion" maxlength="2000" placeholder="Extensión para editar imágenes"></textarea></label>
        <label>Categoría
          <select name="categoria">
            <option>Productividad</option>
            <option>Utilidades</option>
            <option>Seguridad</option>
            <option>Entretenimiento</option>
            <option>Otra</option>
          </select>
        </label>
        <label>Función principal
          <select name="funcionPrincipal" id="funcion"></select>
        </label>
        <p class="pista" id="pista-funcion"></p>
        <label>Desarrollador <input name="desarrollador" maxlength="160" placeholder="Opcional"></label>
        <label>Versión <input name="version" required value="1.0" maxlength="40"></label>
        <button type="submit">Generar informe</button>
        <p id="error-alta" class="aviso error" hidden></p>
      </div>
      <div>
        <h2>Permisos solicitados</h2>
        <div id="checks-alta"></div>
      </div>
    </form>
  `);

  const select = document.querySelector("#funcion");
  select.innerHTML = perfiles.map((p) => `<option value="${esc(p.clave)}">${esc(p.titulo)}</option>`).join("");
  const pista = document.querySelector("#pista-funcion");
  const actualizarPista = () => {
    const perfil = perfiles.find((p) => p.clave === select.value);
    pista.textContent = perfil
      ? `${perfil.descripcion} Suele necesitar: ${perfil.sueleNecesitar.join(", ")}.`
      : "";
  };
  select.addEventListener("change", actualizarPista);
  actualizarPista();
  document.querySelector("#checks-alta").append(listaPermisos(permisos, new Set()));

  document.querySelector("#alta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const boton = form.querySelector("button");
    const aviso = document.querySelector("#error-alta");
    const datos = new FormData(form);
    const marcados = permisosMarcados(form);
    if (!marcados.length) {
      aviso.hidden = false;
      aviso.textContent = "Marca al menos un permiso.";
      return;
    }
    aviso.hidden = true;
    boton.disabled = true;
    boton.textContent = "Analizando…";
    try {
      const creada = await api.post("/api/aplicaciones", {
        nombre: datos.get("nombre"),
        descripcion: datos.get("descripcion"),
        categoria: datos.get("categoria"),
        funcionPrincipal: datos.get("funcionPrincipal"),
        desarrollador: datos.get("desarrollador"),
        version: datos.get("version"),
        permisos: marcados
      });
      location.hash = `#/aplicaciones/${creada.id}`;
    } catch (error) {
      aviso.hidden = false;
      aviso.textContent = error.message;
      boton.disabled = false;
      boton.textContent = "Generar informe";
    }
  });
}

function listaPermisos(permisos, seleccionados) {
  const orden = ["Bajo", "Medio", "Alto", "Critico"];
  const nombres = { Bajo: "Sensibilidad baja", Medio: "Sensibilidad media", Alto: "Sensibilidad alta", Critico: "Sensibilidad crítica" };
  const raiz = document.createElement("div");
  raiz.className = "grupos";
  for (const nivel of orden) {
    const grupo = permisos.filter((p) => p.nivelRiesgo === nivel);
    if (!grupo.length) continue;
    const seccion = document.createElement("section");
    seccion.className = "grupo";
    seccion.innerHTML = `<h3>${nombres[nivel]}</h3>`;
    for (const permiso of grupo) {
      const etiqueta = document.createElement("label");
      etiqueta.className = "check";
      etiqueta.innerHTML = `
        <input type="checkbox" name="permiso" value="${esc(permiso.clave)}" ${seleccionados.has(permiso.clave) ? "checked" : ""}>
        <span>${esc(permiso.nombre)}<small>${esc(permiso.consecuencia)}</small></span>`;
      seccion.append(etiqueta);
    }
    raiz.append(seccion);
  }
  return raiz;
}

function permisosMarcados(form) {
  return [...form.querySelectorAll("input[name=permiso]:checked")].map((input) => input.value);
}

async function vistaHistorial() {
  const filas = await api.get("/api/analisis");
  const cuerpo = filas.map((fila) => `
    <tr>
      <td><a href="#/aplicaciones/${fila.aplicacionId}">${esc(fila.nombre)}</a><div class="meta">v${esc(fila.version)}</div></td>
      <td>${fecha(fila.fecha)}</td>
      <td>${esc(fila.puntuacion)}</td>
      <td>${insignia(fila.nivelRiesgo, fila.nivelEtiqueta)}</td>
      <td>${fila.cambioImportante ? "Cambio importante" : "—"}</td>
    </tr>`).join("");
  pintar(`
    <section class="introduccion">
      <p class="ceja">Registro</p>
      <h1>Historial de análisis</h1>
      <p>Cada versión conserva la puntuación y la explicación de cuando se evaluó.</p>
    </section>
    ${filas.length ? `<table><thead><tr><th>Aplicación</th><th>Fecha</th><th>Puntuación</th><th>Nivel</th><th>Cambio</th></tr></thead><tbody>${cuerpo}</tbody></table>` : `<p>No hay análisis todavía.</p>`}
  `);
}

async function vistaCatalogo() {
  const permisos = await api.get("/api/permisos");
  pintar(`
    <section class="introduccion">
      <p class="ceja">Referencia</p>
      <h1>Catálogo de permisos</h1>
      <p>El catálogo está modelado sobre permisos de extensiones de Chrome y los accesos del ejemplo: cámara, micrófono, archivos y sitios web.</p>
    </section>
    <label class="buscador">Buscar <input id="buscar" type="search" placeholder="historial, cámara, sitios"></label>
    <div id="catalogo"></div>
  `);
  const caja = document.querySelector("#catalogo");
  const dibujar = (lista) => {
    caja.innerHTML = lista.map((permiso) => `
      <article class="permiso" style="margin-bottom:10px" data-texto="${esc(`${permiso.nombre} ${permiso.clave} ${permiso.descripcion}`.toLowerCase())}">
        <header>
          <h3>${esc(permiso.nombre)}</h3>
          ${insignia(permiso.nivelRiesgo, permiso.nivelEtiqueta)}
        </header>
        <p>${esc(permiso.descripcion)}</p>
        <p class="aporte">${esc(permiso.consecuencia)}. Propósitos: ${esc(permiso.propositos.join(", "))}.</p>
      </article>`).join("") || `<p>Ningún permiso coincide con la búsqueda.</p>`;
  };
  dibujar(permisos);
  document.querySelector("#buscar").addEventListener("input", (evento) => {
    const q = evento.target.value.trim().toLowerCase();
    dibujar(permisos.filter((p) => `${p.nombre} ${p.clave} ${p.descripcion} ${p.consecuencia}`.toLowerCase().includes(q)));
  });
}

function tono(nivel) {
  return { Bajo: "#1f6b45", Medio: "#8a5a10", Alto: "#b4532a", Critico: "#8f2430" }[nivel] || "#1c1915";
}

window.addEventListener("hashchange", enrutar);
if (!location.hash) location.hash = "#/aplicaciones";
else enrutar();
