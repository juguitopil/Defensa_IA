# Defensa_IA — SafeUpdate (módulo embebible)

Evaluación preventiva de software: evidencias estructuradas, cobertura del análisis e IA explicadora (plantilla determinista en MVP).

## Requisitos

- [.NET SDK 10](https://dotnet.microsoft.com/download) (o 8+ con runtime correspondiente)

## Ejecutar

```powershell
cd "C:\Users\Hp\VSC WORK\Defensa_IA"
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

## Próximos pasos (pruebas técnicas avanzadas)

1. Authenticode en worker Windows aislado.
2. Fuente de reputación con API key y caché.
3. JWT de la plataforma madre en lugar de headers demo.
4. PostgreSQL para historial multi-usuario.
