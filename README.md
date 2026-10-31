# Sello

Cliente de correo web con una capa de seguridad siempre visible. Cada mensaje lleva un sello de confianza: primero un análisis estático (remitente, texto, enlaces, adjuntos) y luego un agente de IA que explica esos hechos en español, sin inventar.

Puedes usarlo con la bandeja de laboratorio o conectar Gmail en **solo lectura**.

## Cómo arrancarlo

Necesitas Node 18 o superior y [pnpm](https://pnpm.io).

```bash
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm dev
```

Abre `http://localhost:5173`.

## Conectar Gmail y el agente

1. Copia `.env.example` a `.env` si quieres guardar las claves en el servidor.
2. En la app, pulsa **Conectar Gmail**.
3. Pega el **Client ID** de Google (aplicación web, origen `http://localhost:5173`, API de Gmail activada, tu correo como usuario de prueba).
4. Pega una clave de [xAI](https://console.x.ai) (`XAI_API_KEY`) para el agente. También vale en el archivo `.env`.
5. Autoriza el acceso. Sello lee la bandeja; no envía ni borra nada en Google.

Sin clave de IA, el sello estático sigue funcionando. Sin Gmail, sigues viendo los correos de demo.

## Cómo se calcula el sello

Se parte de 100 y se restan puntos solo por hallazgos reales del mensaje.

| Nota | Rango |
| --- | --- |
| Bajo riesgo | 75–100 |
| Riesgo medio | 45–74 |
| Alto riesgo | 0–44 |

El agente no cambia el sello a ciegas: solo añade explicación y, si cita evidencia nueva del propio correo, un hallazgo extra.

## Estructura

- `src/data/seed.ts` — correos de ejemplo
- `src/lib/security/` — análisis estático y cliente del agente
- `src/lib/gmail/` — OAuth y parseo de Gmail
- `server/ai-plugin.ts` — llamada a xAI desde el servidor de Vite
- `src/store.tsx` — estado de la bandeja
