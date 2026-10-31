# Sello — documentación del programa

Sello es una **capa de seguridad siempre visible** sobre el correo. La forma de usarlo de verdad es la **extensión de navegador**: te quedas en Gmail, con cualquier cuenta, y al abrir un mensaje ves el sello, el semáforo y el porqué. No pide otro inicio de sesión.

Sigue existiendo una **bandeja de laboratorio** en la web para probar correos de ejemplo sin Gmail.

---

## 1. La idea

Hoy el correo es el canal más usado para phishing, facturas falsas, PDFs tramposos y enlaces que no van donde dicen. Los clientes normales (Gmail, Outlook) avisan a veces, pero la seguridad se siente como un extra: un banner, un filtro, un “puede ser peligroso”.

Sello parte de otra premisa:

- La seguridad no interrumpe el uso normal.
- El riesgo se ve **en la lista y al abrir** el correo.
- Cada nota se **explica** (por qué ese score, qué hay en el remitente, los enlaces y los adjuntos).
- Si el riesgo es alto, hay un aviso fuerte, pero **se puede seguir leyendo**.
- Los archivos **nunca se ejecutan**. Solo se leen como texto (análisis estático).

El nombre “Sello” es esa marca de confianza: un número de 0 a 100 y un semáforo (verde / ámbar / rojo).

La cuenta de demostración es **Alex Cerezo** (`alex@sello.mail`).

---

## 2. Qué hace el programa hoy

### 2.1 Cliente de correo

Interfaz tipo webmail actual, en español:

| Acción | Comportamiento |
| --- | --- |
| Bandeja | Lista de correos con remitente, asunto, vista previa, fecha y sello |
| Lectura | Cuerpo del mensaje, remitente, destinatarios, adjuntos |
| Redactar | Correo nuevo (simulado: queda en Enviados) |
| Responder / Reenviar | Abre el redactor con el hilo citado |
| Destacar | Marca con estrella |
| Leído / no leído | Cambia el estado |
| Archivar | Pasa a Archivo |
| Eliminar | Pasa a Papelera; desde ahí se borra del todo |
| Buscar | Filtra por asunto, nombre, email o texto |
| Filtro de riesgo | Todos / Alto / Medio / Bajo |
| Alertas | Vista solo de correos de riesgo medio o alto |

Carpetas: **Bandeja**, **Alertas**, **Destacados**, **Enviados**, **Archivo**, **Papelera**.

En pantallas pequeñas la lista y la lectura se alternan; en escritorio conviven lista, lectura y panel de seguridad.

### 2.2 Capa de seguridad (siempre activa)

Cada correo tiene un **sello de confianza**:

- Número **0–100** (se parte de 100 y se restan puntos).
- Nivel:
  - **Bajo riesgo**: 75–100 (verde)
  - **Riesgo medio**: 45–74 (ámbar)
  - **Alto riesgo**: 0–44 (rojo)

El sello aparece:

1. En cada fila de la lista.
2. Al abrir el mensaje.
3. En el panel lateral **Seguridad** (se puede plegar).

El panel explica, en lenguaje cercano:

- Por qué tiene esa nota.
- Análisis del remitente (nombre vs dominio, reply-to, autenticación SPF/DKIM/DMARC).
- Enlaces encontrados y si el destino es raro (IP, acortador, texto que no coincide, http, dominio que imita una marca).
- Adjuntos, sobre todo PDFs.
- Recomendaciones concretas (no pulses, no respondas, entra tú a la web oficial, etc.).

Si el correo es de **alto riesgo**, sale un aviso: se puede leer igual, pero se pide confirmación antes de abrir un enlace o descargar un archivo.

### 2.3 Análisis de PDFs

Solo **análisis estático**: se lee el texto interno del PDF. No se abre en un visor ni se ejecuta JavaScript.

Indicadores que busca:

- JavaScript (`/JavaScript`, `/JS`)
- Acción al abrir (`/OpenAction`)
- Acciones adicionales (`/AA`)
- Lanzar un programa (`/Launch`)
- Archivos embebidos (`/EmbeddedFile`, `/Filespec`)
- Saltos a otros documentos (`/GoToR`, `/GoToE`)
- Envío de formularios (`/SubmitForm`)
- URLs (`/URI`)
- Formularios XFA / AcroForm
- Multimedia, cifrado, objetos comprimidos (`/ObjStm`)

También decodifica nombres PDF en hex (`#53` → `S`) para no perder indicadores ofuscados.

### 2.4 Agente de explicación

Al abrir un correo, un **agente** escribe un veredicto y observaciones en español.

- Por defecto usa el **agente local**: parte solo de los hallazgos reales del motor estático. No inventa amenazas.
- Si hay una clave de xAI (`XAI_API_KEY`), el servidor puede pedir una explicación a Grok. Si Grok no está o falla, se usa el agente local.

El agente **no sustituye** el sello numérico: lo explica. Solo añadiría un hallazgo extra si viniera con evidencia del propio mensaje.

### 2.5 Fuentes de correo

Hay tres caminos:

1. **Bandeja de laboratorio** (la que funciona al abrir la app). Correos de ejemplo de bajo, medio y alto riesgo.
2. **Importar un `.eml`**. Sirve para analizar un correo real sin conectar Gmail.
3. **Gmail en solo lectura**. Requiere registrar la app en Google Cloud una vez (OAuth). Después, cualquier usuario puede pulsar **Continuar con Google** y Sello lee su bandeja. No envía ni borra nada en Google.

Hoy, sin ese registro, **Continuar con Google** no puede abrir el selector de cuentas: Google no deja leer Gmail a una app no dada de alta. El ID de cliente es de **la app**, no de una persona. Si el consentimiento está en **Externo y publicado**, puede entrar cualquier Gmail; si está en **Prueba**, solo los testers.

---

## 3. Cómo se calcula el sello

El motor está en `src/lib/security/analyze.ts`. No se inventan hallazgos: solo se puntúa lo que hay en el mensaje.

Se parte de **100**. Ejemplos de restas:

| Hallazgo | Puntos (aprox.) |
| --- | ---: |
| Dominio que imita una marca | 26 |
| Nombre de marca con dominio ajeno | 22 |
| JavaScript en un PDF | 28 |
| OpenAction / Launch / embebidos en PDF | 22 |
| Pedir contraseña, PIN o “iniciar sesión” | 20 |
| Acortador (bit.ly, cutt.ly, etc.) | 18 |
| Reply-To a otro dominio | 16 |
| SPF/DKIM/DMARC en fail | 14 |
| Texto urgente / “tu cuenta será bloqueada” | 12 |
| Dominio desconocido (primera vez) | 10 |
| Nombre visible y cuenta no se parecen | 8 |

El resultado se recorta entre 0 y 100 y se traduce al semáforo.

Marcas que el motor conoce para comparar dominios: PayPal, Microsoft, Google, Apple, Amazon, DHL, FedEx, UPS, Correos, BBVA, Santander, CaixaBank, Hacienda, Adobe, Dropbox.

Dominios de confianza en la demo: `sello.mail`, `northline.es`.

---

## 4. Correos de ejemplo (para la demo)

Están en `src/data/seed.ts`. Cubren los casos del brief:

| Correo | Idea | Riesgo típico |
| --- | --- | --- |
| Marta Ruiz — notas del sprint | Compañera interna, limpio | Bajo (100) |
| PayPal falso | Nombre PayPal, dominio ajeno, IP, prisa, pedir identidad | Alto |
| DHL + PDF | Marca falsa, bit.ly, PDF con JS y OpenAction | Alto |
| Factura Northline | Proveedor conocido, PDF limpio | Bajo |
| Microsoft 365 | Dominio `rnicrosoft-online.com`, enlace que no coincide | Alto |
| Personas Sello | RR. HH. interno | Bajo |
| Clara Vives (Luma) | Primer contacto, PDF con formulario/URL | Bajo–medio |
| BBVA | PIN, punycode, reply-to raro | Alto |
| Ignacio — reunión | Interno | Bajo |
| Helena Costa | Acortador cutt.ly, dominio nuevo | Medio |
| “Soporte Adobe” | PDF con Launch y archivo embebido | Alto |
| Newsletter Northline | Correo de producto legítimo | Bajo |
| Nómina HTML | Adjunto `.html` + “iniciar sesión” | Alto |
| Enviado / archivado | Correos propios para probar carpetas | Bajo |

Los PDF de laboratorio están en `src/data/lab-pdfs.ts`. Son muestras de texto tipo PDF, no se ejecutan.

---

## 5. Cómo está montado (arquitectura)

Aplicación **React + TypeScript + Vite + Tailwind**. Gestor de paquetes: **pnpm** (npm está bloqueado a propósito).

```
src/
  App.tsx                 # Layout: barra, lista, lectura, seguridad
  store.tsx               # Estado de la bandeja, Gmail, agente
  types.ts                # Correo, hallazgos, informe de seguridad
  data/seed.ts            # Correos de ejemplo
  data/lab-pdfs.ts        # PDF de laboratorio
  lib/security/analyze.ts # Motor de puntuación
  lib/security/pdf.ts     # Análisis estático de PDF
  lib/security/agent.ts   # Cliente del agente (local o xAI)
  lib/security/local-agent.ts
  lib/adapters/mock.ts    # Bandeja simulada
  lib/adapters/gmail.ts   # Lectura Gmail API
  lib/gmail/auth.ts       # OAuth (Google Identity)
  lib/gmail/parse.ts      # De mensaje Gmail a Mail
  lib/import/eml.ts       # Importar .eml
  lib/sanitize.ts         # Limpia HTML antes de mostrarlo
  components/             # UI
server/ai-plugin.ts       # /api/analyze y /api/status (Vite)
```

Flujo de un correo:

1. Llega por seed, `.eml` o Gmail.
2. `analyzeMail` genera el informe estático (score, hallazgos, enlaces, PDF).
3. Al abrirlo, el agente escribe el veredicto.
4. La UI pinta sello, aviso y panel.

El adaptador (`MailAdapter`) permite cambiar de laboratorio a Gmail sin rehacer la interfaz.

**Envío:** en laboratorio se simula (aparece en Enviados). En Gmail el envío real no está activado (solo lectura).

**HTML de correos reales:** se sanitiza (sin scripts, iframes ni `javascript:`) antes de pintarlo.

---

## 6. Interfaz y tono

- Textos en **español**, cercanos, sin jerga innecesaria.
- Colores de riesgo fijos: verde `#1c6b48`, ámbar `#9a5a10`, rojo `#a12a2c`.
- Tipografías: **Commissioner** (interfaz) y **Literata** (cuerpo del correo).
- Icono de la app: calabaza de Halloween (sin fondo), en la barra y en la pestaña.
- El panel de seguridad se pliega; no tapa el uso del correo.
- Estados vacíos: “esta vista está vacía”, búsquedas sin resultado, etc.

---

## 7. Cómo correrlo

Hace falta Node 18 o superior y pnpm.

```bash
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm build:extension
```

Carga `dist-extension` como extensión descomprimida y abre Gmail.

Laboratorio del sello (sin instalar): `pnpm dev` y `http://localhost:5173?lab=gmail`.

Bandeja de prueba: `http://localhost:5173`.

---

## 8. Qué está listo y qué no

**Listo**

- Extensión sobre Gmail: cualquier cuenta, sin otro login.
- Sello, semáforo y panel explicativo en el correo abierto.
- Análisis estático de contenido, remitente, enlaces y PDFs (sin ejecutarlos).
- Agente local de explicación.
- Laboratorio web y bandeja de prueba.

**Pendiente**

- Publicar la extensión en Chrome Web Store.
- Agente Grok en la nube (hace falta `XAI_API_KEY`).
- SPF/DKIM/DMARC: Gmail no los muestra en la vista normal; el sello no los inventa.

---

## 9. Principios que no se negocian

1. La seguridad se ve siempre, pero no impide usar el correo.
2. Las explicaciones salen de lo que hay en el mensaje; no se inventan.
3. El score se puede explicar (“partimos de 100, restamos por X”).
4. Un PDF o un enlace sospechoso no se ejecuta; como mucho se descarga avisando.
5. En Gmail Sello solo mira el mensaje abierto; no envía ni borra.
6. Un usuario normal no configura Client IDs: entra en Gmail y ya.

---

## 10. Destinatario de este prototipo

Personas que ya viven en el correo (trabajo, facturas, envíos, bancos) y quieren **entender el riesgo sin ser expertas en ciberseguridad**. Sello debe sentirse cómodo el primer día: como un webmail, con un sello que se entiende de un vistazo.
