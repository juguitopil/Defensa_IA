const CLIENT_KEY = "sello.googleClientId";
const AI_KEY = "sello.xaiKey";

function looksLikeClientId(value: string): boolean {
  return value.includes(".apps.googleusercontent.com");
}

export function loadGoogleClientId(): string {
  const stored = localStorage.getItem(CLIENT_KEY) || "";
  if (looksLikeClientId(stored)) return stored;
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  return looksLikeClientId(fromEnv) ? fromEnv : stored;
}

export function saveGoogleClientId(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    localStorage.removeItem(CLIENT_KEY);
    return;
  }
  localStorage.setItem(CLIENT_KEY, trimmed);
}

export async function resolveGoogleClientId(): Promise<string> {
  const local = loadGoogleClientId();
  if (looksLikeClientId(local)) return local;
  try {
    const response = await fetch("/api/google-client");
    const data = (await response.json()) as { clientId?: string };
    if (looksLikeClientId(data.clientId || "")) {
      saveGoogleClientId(data.clientId!);
      return data.clientId!;
    }
  } catch {
    /* el servidor puede no tenerlo aún */
  }
  return local;
}

export function ingestGoogleClientPayload(raw: string): string {
  const text = raw.trim();
  if (looksLikeClientId(text) && !text.startsWith("{")) {
    saveGoogleClientId(text);
    return text;
  }
  const data = JSON.parse(text) as {
    web?: { client_id?: string };
    installed?: { client_id?: string };
    client_id?: string;
  };
  const clientId = data.web?.client_id || data.installed?.client_id || data.client_id || "";
  if (!looksLikeClientId(clientId)) {
    throw new Error("Ese archivo no tiene un Client ID de aplicación web.");
  }
  saveGoogleClientId(clientId);
  return clientId;
}

export function loadLocalAiKey(): string {
  return localStorage.getItem(AI_KEY) || "";
}

export function saveLocalAiKey(value: string): void {
  if (!value.trim()) {
    localStorage.removeItem(AI_KEY);
    return;
  }
  localStorage.setItem(AI_KEY, value.trim());
}
