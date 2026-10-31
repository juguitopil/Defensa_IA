# Defensa_IA

Monorepo de la hackathon. Ahora mismo hay dos piezas:

- **Sello** — sello de confianza sobre el correo, dentro de Gmail.
- **SafeUpdate** — módulo embebible de evaluación preventiva de software.

---

# Sello

## La idea

El correo es el canal habitual del phishing: facturas falsas, PDFs tramposos y enlaces que no van donde dicen. Gmail a veces avisa, pero la seguridad se siente como un extra.

Sello es la marca que se ve al leer. Te quedas en Gmail, con tu cuenta o con cualquier otra, y al abrir un mensaje aparece a la derecha una nota de 0 a 100, un semáforo y el porqué. No pide otro inicio de sesión. No corta la lectura: si el riesgo es alto, avisa y puedes seguir leyendo. Los archivos no se ejecutan; solo se leen como texto.

## Qué hay hoy

- Extensión para Chrome, Edge o Brave. El panel vive a la derecha de Gmail.
- Lee el mensaje abierto en la página y pone ahí la nota, el semáforo y la explicación.
- Cuenta el remitente, los enlaces, los adjuntos y qué conviene hacer.
- La barra izquierda del panel se arrastra. El ancho lo eliges tú, entre 280 y 520 px (un poco menos si la ventana es estrecha), y se recuerda. Gmail cede justo ese espacio, una sola vez, para que no quede un hueco con el tema de fondo.
- Se puede ocultar. Queda una pestaña con la calabaza para volver a abrirlo.
- Sigue habiendo un laboratorio web, con correos de ejemplo, para probar sin Gmail.

## Instalar

```bash
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm build:extension
```

1. Abre `chrome://extensions` (o `brave://extensions` / `edge://extensions`).
2. Activa **Modo de desarrollador**.
3. **Cargar descomprimida** → carpeta `dist-extension`.
4. Entra en [Gmail](https://mail.google.com) y abre un mensaje.

Si ya la tenías cargada, pulsa **Actualizar** en Sello y recarga Gmail.

## Cómo se calcula el sello

Se parte de 100 y se restan puntos solo por lo que hay en el mensaje.

| Nota | Rango |
| --- | --- |
| Bajo riesgo | 75–100 |
| Riesgo medio | 45–74 |
| Alto riesgo | 0–44 |

## Laboratorio

```bash
pnpm dev
```

- Bandeja de prueba: `http://localhost:5173`
- Panel como en Gmail: `http://localhost:5173?lab=gmail`

El detalle está en `DOCUMENTACION.md`.

---

# SafeUpdate (módulo embebible)

Evaluación preventiva de software: evidencias estructuradas, cobertura del análisis e IA explicadora (plantilla determinista en MVP).

## Requisitos

- [.NET SDK 10](https://dotnet.microsoft.com/download) (o 8+ con runtime correspondiente)

## Ejecutar

```powershell
dotnet restore SafeUpdate.sln
dotnet run --project src/SafeUpdate.Api/SafeUpdate.Api.csproj
```

- API: `http://localhost:5080`
- Demo plataforma madre: `http://localhost:5080/host`
- Módulo standalone: `http://localhost:5080/module`

## Pruebas unitarias

```powershell
dotnet test SafeUpdate.sln
```

## Prueba técnica (smoke)

Con la API en marcha:

```powershell
.\scripts\technical-smoke.ps1 -BaseUrl http://localhost:5080
```

## API (integración con otra página)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/v1/analyses` | `multipart/form-data`: `file`, `expectedProduct` (opcional) → `202` |
| GET | `/v1/analyses/{id}` | Estado + informe |
| GET | `/v1/analyses/{id}/report` | Solo informe |
| GET | `/v1/capabilities` | Analizadores activos |

Headers opcionales (simulan la plataforma madre):

- `X-User-Id`, `X-Tenant-Id`
- `X-Api-Key` si `SafeUpdate:ApiKey` está configurado en `appsettings.json`

## Seguridad (MVP)

- Límite de tamaño al subir (32 MiB por defecto).
- Nombres de archivo sanitizados; almacenamiento fuera de rutas servidas.
- Cola + worker en segundo plano con timeout por job.
- Reputación externa deshabilitada (sin SSRF accidental).
- No se ejecutan binarios subidos.

## Estructura

```
src/SafeUpdate.Domain          Modelos y enums
src/SafeUpdate.Application     Orquestador, riesgo, informe
src/SafeUpdate.Analyzers       Plugins de análisis
src/SafeUpdate.Infrastructure  Cola, almacenamiento, worker
src/SafeUpdate.Api             REST + estáticos embebidos
web/                           UI liviana para embeber
schemas/                       JSON Schema del informe
tests/                         xUnit
```
