# Defensa_IA

Monorepo de la hackathon. Ahora mismo hay dos piezas:

- **Sello** — extensión de Gmail con nota 0–100, semáforo y el porqué.
- **SafeUpdate** — módulo embebible de evaluación preventiva de software.

---

# Sello

Extensión para Chrome, Edge o Brave. Se pone a la **derecha de Gmail** y marca el correo abierto. No pide otra sesión: sirve con tu cuenta y con cualquier otra.

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

## Cómo se calcula el sello

Se parte de 100 y se restan puntos solo por lo que hay en el mensaje.

| Nota | Rango |
| --- | --- |
| Bajo riesgo | 75–100 |
| Riesgo medio | 45–74 |
| Alto riesgo | 0–44 |

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
