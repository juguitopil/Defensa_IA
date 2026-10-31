# Sello — documentación del programa

Sello es una **marca de confianza sobre el correo**. La forma de usarlo es la **extensión de navegador**: te quedas en Gmail, con cualquier cuenta, y al abrir un mensaje ves a la derecha la nota, el semáforo y el porqué. No pide otro inicio de sesión.

Sigue existiendo una **bandeja de laboratorio** en la web para probar correos de ejemplo sin Gmail.

---

## 1. La idea

Hoy el correo es el canal más usado para phishing, facturas falsas, PDFs tramposos y enlaces que no van donde dicen. Los clientes normales avisan a veces, pero la seguridad se siente como un extra: un banner, un filtro, un “puede ser peligroso”.

Sello parte de otra premisa:

- No hace falta dejar Gmail ni iniciar sesión otra vez. El sello aparece donde ya lees.
- La seguridad no interrumpe el uso normal.
- El riesgo se ve **al abrir** el correo: un número y un color.
- Cada nota se **explica** (por qué ese score, qué hay en el remitente, los enlaces y los adjuntos).
- Si el riesgo es alto, hay un aviso fuerte, pero **se puede seguir leyendo**.
- Los archivos **nunca se ejecutan**. Solo se leen como texto (análisis estático).
- El panel ocupa el ancho que la persona elige. No deja un hueco fijo al lado del correo.

El nombre “Sello” es esa marca: un número de 0 a 100 y un semáforo (verde / ámbar / rojo).

La cuenta de demostración del laboratorio es **Alex Cerezo** (`alex@sello.mail`). En Gmail vale cualquier cuenta que ya esté abierta en el navegador.

---

## 2. Qué hace el programa hoy

### 2.1 Extensión en Gmail

Es el uso real. Chrome, Edge o Brave.

| Qué | Cómo |
| --- | --- |
| Dónde está | Panel fijo a la derecha de Gmail, por encima de la página |
| Qué lee | El mensaje que está abierto en pantalla. No descarga la bandeja ni pide OAuth |
| Qué muestra | Nota 0–100, semáforo, veredicto, hallazgos, remitente, enlaces, adjuntos y qué conviene hacer |
| Ocultar | El panel se pliega y queda una pestaña (calabaza, “Sello”, la nota y **Mostrar**) |
| Cuentas | La que ya uses en Gmail, y cualquier otra en el mismo navegador |

El popup de la extensión no es el panel. Solo abre Gmail y recuerda recargar la pestaña.

### 2.2 La barra de ancho

El borde izquierdo del panel es una barra. Se arrastra:

- Hacia la izquierda, el panel crece.
- Hacia la derecha, se estrecha.
- Doble clic lo devuelve al tamaño inicial (352 px).
- Con el teclado, enfocada la barra: flechas de 16 px, con Mayús de 48 px.

El ancho queda entre **280 y 520 px**. Si la ventana es estrecha, el máximo baja hasta el 45 % del ancho. Se guarda en el navegador (`localStorage`, clave `sello.panelWidth`) y se recupera al volver a Gmail.

Gmail no se empuja con varios márgenes anidados. Eso sumaba hueco y dejaba ver el tema de fondo en el centro. Ahora el margen derecho se aplica **una sola vez**, en la columna principal del correo, y mide exactamente lo que mide el panel. El divisor interno de Gmail sigue pudiendo moverse.

### 2.3 Bandeja de laboratorio

Sigue en la web, para demos sin instalar la extensión. Interfaz tipo webmail, en español:

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

`http://localhost:5173?lab=gmail` muestra el mismo panel de la extensión junto a un correo de prueba.

### 2.4 Capa de seguridad

Cada correo tiene un **sello de confianza**:

- Número **0–100** (se parte de 100 y se restan puntos).
- Nivel:
  - **Bajo riesgo**: 75–100 (verde)
  - **Riesgo medio**: 45–74 (ámbar)
  - **Alto riesgo**: 0–44 (rojo)

En la extensión el sello está en el panel del mensaje abierto. En el laboratorio también aparece en cada fila de la lista y al abrir el mensaje. El panel del laboratorio se puede plegar.

El panel explica, en lenguaje cercano:

- Por qué tiene esa nota.
- Análisis del remitente (nombre vs dominio, reply-to, autenticación SPF/DKIM/DMARC cuando ese dato existe).
- Enlaces encontrados y si el destino es raro (IP, acortador, texto que no coincide, http, dominio que imita una marca).
- Adjuntos, sobre todo PDFs.
- Recomendaciones concretas (no pulses, no respondas, entra tú a la web oficial, etc.).

Si el correo es de **alto riesgo**, sale un aviso: se puede leer igual. En el laboratorio se pide confirmación antes de abrir un enlace o descargar un archivo.

### 2.5 Análisis de PDFs

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

En Gmail, si el adjunto es un PDF y la página deja descargarlo, la extensión intenta leerlo para ese análisis. Si no puede, el sello sigue con el resto del mensaje.

### 2.6 Agente de explicación

Al abrir un correo, un **agente** escribe un veredicto y observaciones en español.

- Por defecto usa el **agente local**: parte solo de los hallazgos reales del motor estático. No inventa amenazas.
- Si hay una clave de xAI (`XAI_API_KEY`), el servidor del laboratorio puede pedir una explicación a Grok. Si Grok no está o falla, se usa el agente local. La extensión en Gmail usa el agente local.

El agente **no sustituye** el sello numérico: lo explica.

### 2.7 Fuentes de correo

Hay tres caminos. El primero es el de uso diario.

1. **Gmail, en la página.** La extensión lee el mensaje abierto. No envía ni borra nada.
2. **Bandeja de laboratorio.** Correos de ejemplo de bajo, medio y alto riesgo.
3. **Importar un `.eml`** en el laboratorio, o **Gmail en solo lectura por OAuth** si la app está dada de alta en Google Cloud. Ese OAuth es del laboratorio, no de la extensión. Sin ese registro, **Continuar con Google** no abre el selector de cuentas.

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

En la vista normal de Gmail no aparecen SPF, DKIM ni DMARC. El sello no los inventa: si no están, no restan por autenticación.

---

## 4. Correos de ejemplo (para la demo)

Están en `src/data/seed.ts`. Cubren los casos del brief del laboratorio:

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
  App.tsx                      # Laboratorio: barra, lista, lectura, seguridad
  store.tsx                    # Estado de la bandeja de prueba
  types.ts                     # Correo, hallazgos, informe de seguridad
  data/seed.ts                 # Correos de ejemplo
  data/lab-pdfs.ts             # PDF de laboratorio
  lib/security/analyze.ts      # Motor de puntuación
  lib/security/pdf.ts          # Análisis estático de PDF
  lib/security/agent.ts        # Cliente del agente (local o xAI)
  lib/security/local-agent.ts
  lib/adapters/mock.ts         # Bandeja simulada
  lib/adapters/gmail.ts        # Lectura Gmail API (solo laboratorio)
  lib/gmail/auth.ts            # OAuth del laboratorio
  lib/import/eml.ts            # Importar .eml
  lib/sanitize.ts              # Limpia HTML antes de mostrarlo
  extension/content.tsx        # Inyecta el panel y reserva el margen en Gmail
  extension/panel.tsx          # Panel y barra de ancho
  extension/panel.css
  extension/gmail.ts           # Lee el mensaje abierto en la página
  extension/run.ts             # Pasa ese mensaje por el motor
  extension/manifest.json
server/ai-plugin.ts            # /api/analyze del laboratorio (Vite)
```

Flujo en Gmail:

1. La extensión detecta un mensaje abierto en la página.
2. `analyzeMail` genera el informe estático.
3. El agente local escribe el veredicto.
4. El panel pinta nota, aviso y explicación.
5. La barra, si se mueve, cambia el ancho del panel y el margen único de Gmail.

Flujo en el laboratorio:

1. Llega por seed, `.eml` o Gmail API.
2. El mismo motor y el mismo agente.
3. La UI pinta sello en la lista, aviso y panel.

**Envío:** en laboratorio se simula (aparece en Enviados). La extensión no envía ni borra.

**HTML:** en el laboratorio se sanitiza (sin scripts, iframes ni `javascript:`) antes de pintarlo. En Gmail el cuerpo lo pinta Gmail; Sello solo lo lee para puntuar.

---

## 6. Interfaz y tono

- Textos en **español**, cercanos, sin jerga innecesaria.
- Colores de riesgo fijos: verde `#1c6b48`, ámbar `#9a5a10`, rojo `#a12a2c`.
- Tipografías: **Commissioner** (interfaz) y **Literata** (cuerpo del correo en el laboratorio).
- Icono: calabaza de Halloween (sin fondo), en la pestaña de la extensión y en la barra del laboratorio.
- El panel se pliega; no tapa el uso del correo.
- La barra de ancho es el borde izquierdo del panel en Gmail.

---

## 7. Cómo correrlo

Hace falta Node 18 o superior y pnpm.

```bash
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm build:extension
```

Carga `dist-extension` como extensión descomprimida y abre Gmail. Si ya estaba cargada, **Actualizar** y recargar Gmail.

Laboratorio del panel: `pnpm dev` y `http://localhost:5173?lab=gmail`.

Bandeja de prueba: `http://localhost:5173`.

---

## 8. Qué está listo y qué no

**Listo**

- Extensión sobre Gmail: cualquier cuenta, sin otro login.
- Sello, semáforo y panel explicativo en el correo abierto.
- Barra para elegir el ancho del panel, recordada en el navegador, con un solo margen en Gmail.
- Análisis estático de contenido, remitente, enlaces y PDFs (sin ejecutarlos).
- Agente local de explicación.
- Laboratorio web y bandeja de prueba.

**Pendiente**

- Publicar la extensión en Chrome Web Store.
- Agente Grok en la extensión (hoy el de la nube solo está en el laboratorio, y hace falta `XAI_API_KEY`).
- SPF/DKIM/DMARC en Gmail: no salen en la vista normal y el sello no los inventa.

---

## 9. Principios que no se negocian

1. La seguridad se ve siempre, pero no impide usar el correo.
2. Las explicaciones salen de lo que hay en el mensaje; no se inventan.
3. El score se puede explicar (“partimos de 100, restamos por X”).
4. Un PDF o un enlace sospechoso no se ejecuta.
5. En Gmail Sello solo mira el mensaje abierto; no envía ni borra.
6. Un usuario normal no configura Client IDs: entra en Gmail y ya.
7. El panel ocupa el sitio que se le pide, sin dejar un hueco vacío al lado del correo.

---

## 10. Destinatario de este prototipo

Personas que ya viven en Gmail (trabajo, facturas, envíos, bancos) y quieren **entender el riesgo sin ser expertas en ciberseguridad**. Sello debe sentirse cómodo el primer día: el mismo correo de siempre, con un sello que se entiende de un vistazo y un panel del ancho que a cada quien le sirva.
