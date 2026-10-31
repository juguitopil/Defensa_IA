const GSI_SRC = "https://accounts.google.com/gsi/client";
export const IDENTITY_SCOPE = "openid email profile";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: "" | "none" | "consent" | "select_account" }) => void };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export interface GoogleProfile {
  email: string;
  name: string;
}

function loadGsi(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Identity.")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity."));
    document.head.appendChild(script);
  });
}

function explainGoogleError(error: string): string {
  const value = error.toLowerCase();
  if (value.includes("popup_closed") || value.includes("closed")) {
    return "Cerraste la ventana de Google. Vuelve a pulsar Continuar con Google.";
  }
  if (value.includes("access_denied") || value.includes("access denied")) {
    return "Google no concedió el permiso.";
  }
  if (value.includes("origin_mismatch") || value.includes("origin")) {
    return "Google rechazó este origen. El cliente debe incluir http://localhost:5173.";
  }
  if (value.includes("invalid_client") || value.includes("unauthorized_client")) {
    return "El cliente de Google no sirve para esta app. Hay que registrar Sello como aplicación web.";
  }
  if (value.includes("idpiframe")) {
    return "Google Identity no arrancó. Recarga la página e inténtalo otra vez.";
  }
  return error;
}

export async function requestAccessToken(
  clientId: string,
  scope: string,
  prompt: "" | "none" | "consent" | "select_account" = "select_account",
): Promise<string> {
  if (!clientId) throw new Error("Falta el registro de Sello en Google.");
  await loadGsi();
  if (!window.google?.accounts.oauth2) {
    throw new Error("Google Identity no está disponible.");
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(explainGoogleError(response.error_description || response.error || "Google no devolvió un token.")));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new Error(explainGoogleError(error.message || error.type || "Se canceló el inicio de sesión con Google.")));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export async function requestGoogleSession(clientId: string): Promise<{ token: string; gmail: boolean }> {
  try {
    const token = await requestAccessToken(clientId, `${IDENTITY_SCOPE} ${GMAIL_SCOPE}`, "select_account");
    return { token, gmail: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Cerraste la ventana")) throw error;
    const token = await requestAccessToken(clientId, IDENTITY_SCOPE, "select_account");
    return { token, gmail: false };
  }
}

export async function requestGmailToken(clientId: string): Promise<string> {
  const session = await requestGoogleSession(clientId);
  if (!session.gmail) {
    throw new Error("Google dejó entrar, pero no autorizó leer Gmail.");
  }
  return session.token;
}

export async function fetchGoogleProfile(token: string): Promise<GoogleProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Google no devolvió el perfil de la cuenta.");
  }
  const data = (await response.json()) as { email?: string; name?: string };
  const email = data.email?.trim();
  if (!email) throw new Error("Google no devolvió el correo de la cuenta.");
  return { email, name: data.name?.trim() || email.split("@")[0] || email };
}

export function revokeGmailToken(token: string): void {
  window.google?.accounts.oauth2.revoke(token);
}
