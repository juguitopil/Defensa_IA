const CLIENT_KEY = "sello.googleClientId";
const AI_KEY = "sello.xaiKey";

export function loadGoogleClientId(): string {
  return localStorage.getItem(CLIENT_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

export function saveGoogleClientId(value: string): void {
  localStorage.setItem(CLIENT_KEY, value.trim());
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
