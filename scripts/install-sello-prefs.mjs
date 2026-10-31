import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(process.cwd(), "dist-extension/manifest.json"), "utf8"));
const der = Buffer.from(manifest.key, "base64");
const digest = createHash("sha256").update(der).digest();
const id = [...digest.subarray(0, 16)]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("")
  .replace(/[0-9a-f]/g, (ch) => String.fromCharCode("a".charCodeAt(0) + Number.parseInt(ch, 16)));

const prefsPath = join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Preferences");
if (!existsSync(prefsPath)) throw new Error("No Preferences");
const prefs = JSON.parse(readFileSync(prefsPath, "utf8"));
prefs.extensions ??= {};
prefs.extensions.ui ??= {};
prefs.extensions.ui.developer_mode = true;
prefs.extensions.settings ??= {};
prefs.extensions.settings[id] = {
  ...prefs.extensions.settings[id],
  active_bit: 0,
  disable_reasons: "0",
  from_webstore: false,
  granted_permissions: {
    api: ["storage"],
    explicit_host: ["https://mail.google.com/*"],
    scriptable_host: ["https://mail.google.com/*"],
  },
  install_time: "13300000000000000",
  location: 4,
  manifest,
  path: join(process.cwd(), "dist-extension"),
  state: 1,
  was_installed_by_default: false,
  was_installed_by_oem: false,
};

writeFileSync(prefsPath, JSON.stringify(prefs));
console.log(JSON.stringify({ id, path: prefs.extensions.settings[id].path, developer_mode: true }));
