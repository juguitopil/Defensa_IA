import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

function looksLikeClientId(value: string): boolean {
  return value.includes(".apps.googleusercontent.com");
}

function readEnvClientId(): string {
  const fromProcess = (process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  if (looksLikeClientId(fromProcess)) return fromProcess;
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return "";
  const match = readFileSync(envPath, "utf8").match(/^VITE_GOOGLE_CLIENT_ID=(.+)$/m);
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, "") || "";
  return looksLikeClientId(value) ? value : "";
}

function saveEnvClientId(clientId: string): void {
  if (!looksLikeClientId(clientId)) return;
  process.env.VITE_GOOGLE_CLIENT_ID = clientId;
  const envPath = join(process.cwd(), ".env");
  const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (/^VITE_GOOGLE_CLIENT_ID=/m.test(previous)) {
    writeFileSync(envPath, previous.replace(/^VITE_GOOGLE_CLIENT_ID=.*$/m, `VITE_GOOGLE_CLIENT_ID=${clientId}`), "utf8");
    return;
  }
  writeFileSync(envPath, `${previous}${previous && !previous.endsWith("\n") ? "\n" : ""}VITE_GOOGLE_CLIENT_ID=${clientId}\n`, "utf8");
}

function clientIdFromJson(raw: string): string {
  const data = JSON.parse(raw) as {
    web?: { client_id?: string };
    installed?: { client_id?: string };
    client_id?: string;
  };
  return data.web?.client_id || data.installed?.client_id || data.client_id || "";
}

function ingestDownloads(): string {
  const current = readEnvClientId();
  if (current) return current;
  const downloads = join(homedir(), "Downloads");
  if (!existsSync(downloads)) return "";
  const files = readdirSync(downloads)
    .filter((name) => /^client_secret.+\.json$/i.test(name) || /^client_secret\.json$/i.test(name))
    .map((name) => join(downloads, name));
  for (const file of files) {
    try {
      const clientId = clientIdFromJson(readFileSync(file, "utf8"));
      if (looksLikeClientId(clientId)) {
        saveEnvClientId(clientId);
        return clientId;
      }
    } catch {
      /* archivo ajenos o JSON roto */
    }
  }
  return "";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function resolveKey(bodyKey?: string): string {
  return (process.env.XAI_API_KEY || process.env.GROK_API_KEY || bodyKey || "").trim();
}

function resolveModel(): string {
  return process.env.XAI_MODEL || "grok-4-fast-reasoning";
}

const SYSTEM = `Eres el agente de seguridad de Sello, un cliente de correo.
Analizas UN correo con hechos que ya se midieron (remitente, autenticación, enlaces, adjuntos, texto).
Reglas:
- Responde solo en español claro, cercano, sin jerga innecesaria.
- No inventes remitentes, enlaces, adjuntos ni amenazas que no estén en los datos.
- Si algo no está en el correo, no lo afirmes.
- Puedes citar frases reales del texto para explicar el riesgo.
- extraFindings solo si hay evidencia literal en el correo o en los hallazgos estáticos. Cada una lleva title, detail, points (4-20), severity (low|medium|high), category (sender|auth|content|link|attachment).
- El score estático es la base. No lo contradigas sin evidencia nueva.
Devuelve SOLO JSON válido con esta forma:
{"summary":"","verdict":"","observations":[""],"recommendations":[""],"extraFindings":[]}`;

async function analyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let payload: { apiKey?: string; mail?: unknown; report?: unknown };
  try {
    payload = JSON.parse(raw) as { apiKey?: string; mail?: unknown; report?: unknown };
  } catch {
    json(res, 400, { error: "El cuerpo no es JSON válido." });
    return;
  }

  const apiKey = resolveKey(payload.apiKey);
  if (!apiKey) {
    json(res, 200, { configured: false });
    return;
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            correo: payload.mail,
            analisis_estatico: payload.report,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    json(res, 502, {
      configured: true,
      error: `El agente de xAI no respondió bien (${response.status}). ${text.slice(0, 240)}`,
    });
    return;
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    json(res, 502, { configured: true, error: "El agente devolvió un texto que no es JSON." });
    return;
  }

  json(res, 200, {
    configured: true,
    summary: parsed.summary,
    verdict: parsed.verdict,
    observations: parsed.observations,
    recommendations: parsed.recommendations,
    extraFindings: parsed.extraFindings,
  });
}

async function route(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const url = req.url ?? "";
  if (!url.startsWith("/api/")) {
    next();
    return;
  }

  try {
    if (url.startsWith("/api/status") && req.method === "GET") {
      json(res, 200, {
        configured: Boolean(resolveKey()),
        model: resolveModel(),
      });
      return;
    }
    if (url.startsWith("/api/google-client") && req.method === "GET") {
      json(res, 200, { clientId: ingestDownloads() || readEnvClientId() });
      return;
    }
    if (url.startsWith("/api/analyze") && req.method === "POST") {
      await analyze(req, res);
      return;
    }
    json(res, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del agente.";
    json(res, 500, { configured: true, error: message });
  }
}

export function selloApi(): Plugin {
  return {
    name: "sello-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void route(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void route(req, res, next);
      });
    },
  };
}
