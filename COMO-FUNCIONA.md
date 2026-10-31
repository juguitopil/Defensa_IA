# Cómo funciona y cómo está hecho SafeUpdate

SafeUpdate es el módulo de **Defensa_IA**. No es un antivirus que diga «seguro» o «virus». Es un **evaluador de confianza**: junta pruebas técnicas, dice qué encontró, qué no pudo comprobar y ayuda a decidir **antes de instalar**.

La idea de fondo:

> Ninguna herramienta puede garantizar que un programa sea seguro. Lo útil es mostrar evidencias, límites y recomendaciones.

Está pensado para vivir **dentro de otra página** (portal, intranet, app web). El usuario no entra a otra aplicación: ve un panel embebido.

---

## 1. Qué puede revisar

| Modo | Qué se entrega | Para qué sirve |
|------|----------------|----------------|
| **Archivo** | Instalador, APK, documento, `.exe` | Revisar un archivo que ya tienes |
| **URL** | Enlace **directo** al archivo (`.apk`, `.exe`, `.pdf`…) | El worker lo descarga con controles anti-SSRF |
| **Actualización** | Copia instalada (baseline) + archivo o URL nueva + versiones | Ver si la «update» es coherente o sospechosa |

No sirve pegar una web como ChatGPT o la Play Store: hace falta el **archivo** o un **enlace de descarga**.

---

## 2. Cómo funciona (flujo)

```text
Usuario (página madre o /host)
        │
        ▼
API  POST /v1/analyses   →  job en cola (202)
        │
        ▼
Worker en segundo plano
  1. Si hay URL: descarga segura
  2. Corre analizadores (sin ejecutar el archivo)
  3. Junta hallazgos
  4. Motor de riesgo + cobertura
  5. Texto explicativo
        │
        ▼
GET /v1/analyses/{id}  →  informe
        │
        ▼
Panel: alerta %, revisión %, confianza %, tarjetas y recomendaciones
```

Pasos en palabras simples:

1. Subes un archivo, una URL o una actualización.
2. La API **no analiza en el mismo instante**: crea un trabajo y responde con un `id`.
3. Un **worker** procesa ese trabajo con límite de tiempo.
4. Cada analizador devuelve hallazgos con evidencia y limitaciones.
5. El **motor de riesgo** decide alerta y cobertura. **No usa IA para firmar, hashear ni puntuar.**
6. Un **explicador** (hoy una plantilla en español) traduce el informe a frases entendibles.
7. El panel muestra el resultado. Los datos técnicos (SHA-256) van abajo, plegados.

Estados del trabajo: `Queued` → `Running` → `Completed` o `Failed`.

---

## 3. Cómo está hecho (arquitectura)

Solución **.NET 10**, capas separadas para que otra página solo hable con la API y el módulo web.

```text
web/                          Panel embebible (HTML/CSS/JS)
src/SafeUpdate.Api            REST, auth demo, estáticos
src/SafeUpdate.Application    Orquestador, riesgo, informe, reglas de URL
src/SafeUpdate.Domain         Finding, ReportV1, enums
src/SafeUpdate.Analyzers      Un plugin por tipo de comprobación
src/SafeUpdate.Infrastructure Cola, disco, worker, descarga HTTP
examples/                     Casos de demo
tests/                        xUnit
schemas/                      Contrato JSON del informe
```

### Capas

| Proyecto | Responsabilidad |
|----------|-----------------|
| **Domain** | Modelos: trabajo, hallazgo, informe v1. Sin dependencias de web. |
| **Application** | Casos de uso: crear análisis, orquestar, correlacionar, calcular riesgo. |
| **Analyzers** | Implementan `IAnalyzer`. Se pueden añadir o quitar sin reescribir la API. |
| **Infrastructure** | Memoria + carpeta `data/uploads`, cola `Channel`, `HttpClient` aislado. |
| **Api** | Endpoints, middleware de API key y `X-User-Id` / `X-Tenant-Id`. |
| **web** | UI para embeber en el host. |

Decisión de diseño: **la IA no verifica firmas ni hashes**. Solo explica un JSON ya validado. Si el explicador se apaga, el informe técnico sigue existiendo.

---

## 4. Analizadores actuales

Todos son **estáticos**: leen el archivo, no lo ejecutan.

| Nombre | Qué hace |
|--------|----------|
| `file_intake` | Tamaño, vacío, primeros bytes (tipo aproximado) |
| `hash_service` | SHA-256 (huella; no implica seguridad) |
| `static_analyzer` | Cabecera PE (`MZ`), extensión vs contenido |
| `apk_package` | Si es `.apk`: ¿es un ZIP? ¿tiene `AndroidManifest.xml`? |
| `url_source` | HTTPS, host y ruta de la URL |
| `update_comparison` | Baseline vs update: hash, tamaño, tipo, downgrade de versión |
| `provenance_checker` | Firma Authenticode **aún no implementada** (lo dice claro) |
| `reputation_service` | Reputación externa **desactivada** en el MVP (sin red) |
| `multi_engine_scan` | Panel tipo VirusTotal **en modo demo** |
| `isolation_worker` | Deja constancia de que el proceso es estático, no sandbox dinámico |

Cada uno responde el mismo formato: analizador, estado, hallazgos (`id`, categoría, gravedad, título, evidencia, limitaciones) y errores.

---

## 5. Cómo se decide el resultado

El **Risk Engine** no suma puntos a ciegas.

- Mira hallazgos (sobre todo gravedad alta/media).
- Mira qué analizadores **terminaron**, **fallaron** o **faltaron**.
- Produce:
  - **Nivel de alerta:** bajo, medio, alto, crítico o sin decisión.
  - **Cobertura:** amplia, a medias o insuficiente.
- Un análisis incompleto **nunca** se convierte en «está bien».

El panel traduce eso a porcentajes:

- **Nivel de alerta:** qué tan preocupante se ve.
- **Qué tanto se pudo revisar:** cobertura del plan de análisis.
- **Confianza en este resultado:** baja si faltan pruebas o hay alertas. **No es un % de seguridad.**

---

## 6. Seguridad de la plataforma

El analizador también es un objetivo. Por eso:

- Tope de tamaño (~32 MiB).
- Nombres sanitizados (sin `..` ni caracteres peligrosos).
- Archivos en `data/uploads`, no servidos como web.
- Cola + timeout por trabajo.
- URLs: solo `http`/`https`, bloqueo de IPs privadas (`127.0.0.1`, `10.x`, `192.168.x`…), límite de redirecciones.
- Rechazo de páginas (ChatGPT, tiendas, etc.): no son descargas.
- La descarga se copia a memoria y se valida que no venga vacía.
- **No se ejecutan** instaladores en el servidor.

Más adelante el worker puede salir a un contenedor sin credenciales. La API ya está separada de los analizadores para eso.

---

## 7. Cómo se integra en otra página

1. El host mantiene login, menú y estilo.
2. Embebe `web/safe-update-module/` (como en `web/host-demo.html`).
3. Llama a la API con el token o, en demo, headers:
   - `X-User-Id`
   - `X-Tenant-Id`
   - `X-Api-Key` (si está configurada)

### Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/health` | ¿Está viva? |
| `GET` | `/v1/capabilities` | Analizadores activos |
| `POST` | `/v1/analyses` | Crear análisis (`mode=file\|url\|update`) |
| `GET` | `/v1/analyses/{id}` | Estado + informe |
| `GET` | `/v1/analyses/{id}/report` | Solo informe |
| `GET` | `/v1/examples` | Lista de demos |
| `POST` | `/v1/examples/{id}` | Ejecutar un caso de demo |

---

## 8. Interfaz

- Demo host: `/host` → `host-demo.html`
- Módulo solo: `/module`

El dashboard muestra título en lenguaje claro («Revisa antes de instalar»), barras de porcentaje, tarjetas por categoría y listas de hallazgos / recomendaciones / huecos. Lo técnico queda en «Datos técnicos».

Los botones de ejemplo usan los archivos de `examples/` (documento limpio, vacío, falso `.exe`, PE, APK, update, archivo idéntico, downgrade).

---

## 9. Cómo levantarlo

```powershell
cd "C:\Users\Hp\VSC WORK\Defensa_IA"
dotnet restore SafeUpdate.sln
dotnet test SafeUpdate.sln
dotnet run --project src/SafeUpdate.Api/SafeUpdate.Api.csproj
```

Por defecto: `http://localhost:5080` (`launchSettings.json`).  
Si el puerto está ocupado:

```powershell
$env:ASPNETCORE_URLS = "http://localhost:5090"
dotnet run --project src/SafeUpdate.Api/SafeUpdate.Api.csproj --no-launch-profile
```

Luego: `http://localhost:5090/host`

---

## 10. Qué no hace (aún)

- No sustituye un antivirus comercial.
- No ejecuta el programa en una máquina virtual (análisis dinámico).
- No verifica firma digital Windows de verdad.
- No consulta VirusTotal / reputación real.
- No entra al teléfono o al PC a leer apps instaladas: hay que **subir** el APK o el instalador.
- No detecta «bugs de negocio»; en actualizaciones compara integridad, tamaño, tipo y versión.

---

## 11. Por qué está hecho así

Para una hackathon y para crecer después:

- **Modular:** cada analista del equipo puede tocar un analizador sin romper el informe.
- **Honesto:** si falta evidencia, el sistema lo dice.
- **Embebible:** la otra página no reimplementa seguridad de archivos.
- **Sustituible:** reputación, firma e IA se enchufan cuando haya claves e infraestructura aislada.
