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
