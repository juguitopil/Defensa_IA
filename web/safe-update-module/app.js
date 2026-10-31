(function () {
  const root = document.getElementById("safe-update-root");
  if (!root) return;

  const apiBase = root.dataset.apiBase || "";
  const userId = root.dataset.userId || "";
  const tenantId = root.dataset.tenantId || "";

  root.innerHTML = `
    <div class="su-panel">
      <h2>Revisar un programa o actualización</h2>
      <label>¿Qué quieres revisar?</label>
      <select id="su-mode">
        <option value="file">Un archivo (instalador, APK, documento)</option>
        <option value="url">Un enlace de descarga</option>
        <option value="update">Una actualización (comparar con lo instalado)</option>
      </select>
      <div id="su-fields-file">
        <label>Archivo</label>
        <input type="file" id="su-file" />
      </div>
      <div id="su-fields-url" hidden>
        <label>Enlace directo al archivo (https)</label>
        <input type="url" id="su-url" placeholder="https://sitio-oficial.com/app.apk" />
        <p class="su-consent">No uses páginas como ChatGPT o tiendas. Tiene que ser el archivo en sí.</p>
      </div>
      <div id="su-fields-update" hidden>
        <label>Versión que ya tienes</label>
        <input type="text" id="su-installed-ver" placeholder="1.0.0" />
        <label>Versión que te ofrecen</label>
        <input type="text" id="su-offered-ver" placeholder="2.0.0" />
        <label>Copia de lo instalado (recomendado)</label>
        <input type="file" id="su-baseline" />
        <label>Archivo de la actualización</label>
        <input type="file" id="su-update-file" />
        <label>O enlace de la actualización</label>
        <input type="url" id="su-update-url" placeholder="https://…/update.apk" />
      </div>
      <label>Nombre del programa (opcional)</label>
      <input type="text" id="su-product" placeholder="Ej. Contabilidad ACME" />
      <p class="su-consent">El archivo no se ejecuta. El resultado ayuda a decidir, no es un certificado de seguridad.</p>
      <button type="button" id="su-submit">Analizar</button>
      <p class="su-consent">Pruebas rápidas para la demo:</p>
      <div id="su-examples" class="su-examples"></div>
      <div class="su-status" id="su-status">Listo para analizar.</div>
      <div class="su-report" id="su-report"></div>
    </div>
  `;

  const modeSelect = document.getElementById("su-mode");
  const submitBtn = document.getElementById("su-submit");
  const statusEl = document.getElementById("su-status");
  const reportEl = document.getElementById("su-report");
  const productInput = document.getElementById("su-product");

  function toggleMode() {
    const m = modeSelect.value;
    document.getElementById("su-fields-file").hidden = m !== "file";
    document.getElementById("su-fields-url").hidden = m !== "url";
    document.getElementById("su-fields-update").hidden = m !== "update";
  }
  modeSelect.addEventListener("change", toggleMode);
  toggleMode();

  function headers() {
    const h = {};
    if (userId) h["X-User-Id"] = userId;
    if (tenantId) h["X-Tenant-Id"] = tenantId;
    return h;
  }

  function riskKey(value) {
    if (typeof value === "number") return ["low", "moderate", "high", "critical", "indeterminate"][value] || "indeterminate";
    return String(value || "").toLowerCase();
  }

  function coverageKey(value) {
    if (typeof value === "number") return ["complete", "partial", "insufficient"][value] || "insufficient";
    return String(value || "").toLowerCase();
  }

  function riskView(level) {
    const key = riskKey(level);
    if (key === "low") return { pct: 22, label: "Alerta baja", text: "No vimos señales graves, pero nadie puede garantizar que sea seguro.", cls: "bar-ok" };
    if (key === "moderate") return { pct: 52, label: "Alerta media", text: "Hay dudas. Revisa el origen antes de instalar.", cls: "bar-warn" };
    if (key === "high") return { pct: 78, label: "Alerta alta", text: "Mejor no instalar hasta comprobar que viene del desarrollador oficial.", cls: "bar-bad" };
    if (key === "critical") return { pct: 94, label: "Alerta crítica", text: "No instales este archivo.", cls: "bar-bad" };
    return { pct: 40, label: "Sin decisión clara", text: "Falta información para decir si conviene o no.", cls: "bar-warn" };
  }

  function coverageView(level) {
    const key = coverageKey(level);
    if (key === "complete") return { pct: 90, label: "Revisión amplia", text: "Se hicieron las comprobaciones previstas de esta versión.", cls: "bar-ok" };
    if (key === "partial") return { pct: 58, label: "Revisión a medias", text: "Algunas pruebas no se pudieron completar.", cls: "bar-warn" };
    return { pct: 28, label: "Revisión insuficiente", text: "Casi no se pudo analizar. No tomes esto como un visto bueno.", cls: "bar-bad" };
  }

  function verdict(risk, coverage, summary) {
    const r = riskKey(risk);
    const c = coverageKey(coverage);
    if (String(summary).includes("incompleto") || c === "insufficient" || c === "2")
      return { title: "Análisis incompleto", text: "No hay datos suficientes. Descarga el archivo desde la web oficial y vuelve a intentarlo." };
    if (r === "critical" || r === "high")
      return { title: "No instales todavía", text: "Aparecieron señales que conviene revisar con calma." };
    if (r === "moderate")
      return { title: "Revisa antes de instalar", text: "No es un «virus confirmado», pero tampoco es un archivo de confianza demostrada." };
    return { title: "Sin alarmas graves", text: "Se ve estable en estas pruebas, pero la ausencia de alertas no es una garantía." };
  }

  function catTone(result) {
    const t = String(result || "").toLowerCase();
    if (t.includes("problema") || t.includes("necesaria")) return { pill: "pill-bad", word: "Atención" };
    if (t.includes("dudos") || t.includes("señal")) return { pill: "pill-warn", word: "Revisar" };
    if (t.includes("no evaluado")) return { pill: "pill-warn", word: "Sin datos" };
    return { pill: "pill-ok", word: "En orden aparente" };
  }

  async function poll(id) {
    for (let i = 0; i < 90; i++) {
      const res = await fetch(`${apiBase}/v1/analyses/${id}`, { headers: headers() });
      const data = await res.json();
      const step = { Queued: "En cola…", Running: "Analizando…", Completed: "Listo", Failed: "No se pudo terminar" }[data.status] || data.status;
      statusEl.textContent = step;
      if (data.status === "Failed") {
        statusEl.textContent = "No se pudo analizar: " + (data.failureReason || "error desconocido");
        renderReport(data);
        return;
      }
      if (data.status === "Completed") {
        statusEl.textContent = "Análisis terminado.";
        renderReport(data);
        return;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    statusEl.textContent = "Tardó demasiado. Inténtalo de nuevo.";
  }

  function renderReport(data) {
    const r = data.report;
    if (!r) {
      reportEl.innerHTML = `<div class="dash-hero"><h3>No hay informe</h3><p>${escapeHtml(data.failureReason || "El análisis no llegó a completarse.")}</p></div>`;
      return;
    }
    const risk = riskView(r.riskLevel);
    const cov = coverageView(r.coverage);
    const trust = Math.round((cov.pct * 0.7) + ((100 - risk.pct) * 0.3));
    const v = verdict(r.riskLevel, r.coverage, r.summaryStatus);
    const cats = (r.categories || []).map((c) => {
      const tone = catTone(c.result);
      return `<article class="cat"><span class="pill ${tone.pill}">${tone.word}</span><b>${escapeHtml(c.category)}</b><p>${escapeHtml(c.result)}</p></article>`;
    }).join("");
    const findings = (r.verifiedFindings || []).slice(0, 8).map((f) => `<li>${escapeHtml(f.statement)}</li>`).join("");
    const missing = (r.missingChecks || []).slice(0, 5).map((m) => `<li>${escapeHtml(m)}</li>`).join("");
    const recs = (r.recommendations || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("");

    reportEl.innerHTML = `
      <section class="dash">
        <div class="dash-hero">
          <h3>${escapeHtml(v.title)}</h3>
          <p>${escapeHtml(v.text)}</p>
        </div>
        <div class="dash-meters">
          <div class="meter">
            <span>Nivel de alerta</span>
            <strong>${risk.pct}%</strong>
            <div class="bar"><i class="${risk.cls}" style="width:${risk.pct}%"></i></div>
            <span>${escapeHtml(risk.label)}. ${escapeHtml(risk.text)}</span>
          </div>
          <div class="meter">
            <span>Qué tanto se pudo revisar</span>
            <strong>${cov.pct}%</strong>
            <div class="bar"><i class="${cov.cls}" style="width:${cov.pct}%"></i></div>
            <span>${escapeHtml(cov.label)}. ${escapeHtml(cov.text)}</span>
          </div>
          <div class="meter">
            <span>Confianza en este resultado</span>
            <strong>${trust}%</strong>
            <div class="bar"><i class="bar-blue" style="width:${trust}%"></i></div>
            <span>Baja si faltan pruebas o hay alertas. No es un porcentaje de «seguridad».</span>
          </div>
        </div>
        <div class="dash-grid">${cats}</div>
        <div class="dash-list">
          <h4>En palabras simples</h4>
          <p class="muted">${escapeHtml(r.aiNarrative || risk.text)}</p>
        </div>
        <div class="dash-list"><h4>Qué se vio</h4><ul>${findings || "<li>Sin hallazgos destacados.</li>"}</ul></div>
        <div class="dash-list"><h4>Qué puedes hacer</h4><ul>${recs || "<li>Descarga solo desde el sitio oficial.</li>"}</ul></div>
        <div class="dash-list"><h4>Qué no se pudo comprobar</h4><ul>${missing || "<li>Nada extra pendiente.</li>"}</ul></div>
        <details class="tech">
          <summary>Datos técnicos</summary>
          <p>Archivo: ${escapeHtml(r.fileName || data.fileName || "")}</p>
          <p>Huella SHA-256: <code>${escapeHtml(r.sha256 || data.sha256 || "no disponible")}</code></p>
          ${data.sourceUrl ? `<p>Origen: ${escapeHtml(data.sourceUrl)}</p>` : ""}
        </details>
      </section>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    reportEl.innerHTML = "";
    statusEl.textContent = "Enviando…";
    const fd = new FormData();
    const mode = modeSelect.value;
    fd.append("mode", mode);
    if (productInput.value.trim()) fd.append("expectedProduct", productInput.value.trim());

    if (mode === "file") {
      const file = document.getElementById("su-file").files[0];
      if (!file) {
        statusEl.textContent = "Elige un archivo.";
        submitBtn.disabled = false;
        return;
      }
      fd.append("file", file);
    } else if (mode === "url") {
      const url = document.getElementById("su-url").value.trim();
      if (!url) {
        statusEl.textContent = "Escribe un enlace.";
        submitBtn.disabled = false;
        return;
      }
      fd.append("downloadUrl", url);
    } else {
      const base = document.getElementById("su-baseline").files[0];
      const upd = document.getElementById("su-update-file").files[0];
      const updUrl = document.getElementById("su-update-url").value.trim();
      const iv = document.getElementById("su-installed-ver").value.trim();
      const ov = document.getElementById("su-offered-ver").value.trim();
      if (!upd && !updUrl) {
        statusEl.textContent = "Falta el archivo o el enlace de la actualización.";
        submitBtn.disabled = false;
        return;
      }
      if (base) fd.append("baselineFile", base);
      if (upd) fd.append("updateFile", upd);
      if (updUrl) fd.append("downloadUrl", updUrl);
      if (iv) fd.append("installedVersion", iv);
      if (ov) fd.append("offeredVersion", ov);
    }

    try {
      const res = await fetch(`${apiBase}/v1/analyses`, { method: "POST", body: fd, headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      statusEl.textContent = "Análisis en cola…";
      await poll(data.id);
    } catch (e) {
      statusEl.textContent = "Error: " + e.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  const examplesBox = document.getElementById("su-examples");
  fetch(`${apiBase}/v1/examples`, { headers: headers() })
    .then((r) => r.json())
    .then((data) => {
      (data.items || []).forEach((ex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "su-example";
        btn.textContent = ex.title;
        btn.title = ex.talkingPoint || "";
        btn.addEventListener("click", async () => {
          submitBtn.disabled = true;
          reportEl.innerHTML = "";
          statusEl.textContent = "Analizando ejemplo: " + ex.title;
          try {
            const res = await fetch(`${apiBase}/v1/examples/${ex.id}`, { method: "POST", headers: headers() });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || res.statusText);
            await poll(body.id);
          } catch (e) {
            statusEl.textContent = "Error: " + e.message;
          } finally {
            submitBtn.disabled = false;
          }
        });
        examplesBox.appendChild(btn);
      });
    })
    .catch(() => {
      examplesBox.textContent = "No se pudieron cargar los ejemplos.";
    });
})();
