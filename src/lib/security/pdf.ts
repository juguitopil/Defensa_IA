import type { PdfIndicator, RiskLevel } from "../../types";

function decodePdfNames(source: string): string {
  return source.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

interface Rule {
  id: string;
  pattern: RegExp;
  label: string;
  detail: string;
  severity: RiskLevel;
}

const RULES: Rule[] = [
  {
    id: "javascript",
    pattern: /\/JavaScript\b|\/JS\b/i,
    label: "JavaScript dentro del PDF",
    detail:
      "Este archivo declara código JavaScript. Un PDF no necesita scripts para mostrar texto o facturas. Quien lo abra podría ejecutar acciones sin quererlo.",
    severity: "high",
  },
  {
    id: "open-action",
    pattern: /\/OpenAction\b/i,
    label: "Acción automática al abrir",
    detail:
      "Hay una /OpenAction: el documento está preparado para hacer algo en cuanto se abre, sin que pulses nada.",
    severity: "high",
  },
  {
    id: "aa",
    pattern: /\/AA\b/,
    label: "Acciones adicionales",
    detail:
      "El PDF define acciones adicionales (/AA) ligadas a páginas o campos. Pueden dispararse al ver o rellenar el documento.",
    severity: "high",
  },
  {
    id: "launch",
    pattern: /\/Launch\b/i,
    label: "Intento de abrir otro programa",
    detail:
      "Aparece /Launch, usado para arrancar un programa o archivo externo. Un PDF de lectura no debería hacer eso.",
    severity: "high",
  },
  {
    id: "embedded",
    pattern: /\/EmbeddedFile\b|\/EmbeddedFiles\b|\/Filespec\b/i,
    label: "Archivos embebidos",
    detail:
      "El PDF lleva otros archivos dentro. A veces es un adjunto legítimo; también es una forma de esconder un ejecutable.",
    severity: "high",
  },
  {
    id: "goto-remote",
    pattern: /\/GoToR\b|\/GoToE\b/i,
    label: "Salto a otro documento",
    detail:
      "Hay un salto a un archivo externo o embebido. Puede usarse para abrir algo que no estás viendo en este momento.",
    severity: "medium",
  },
  {
    id: "submit-form",
    pattern: /\/SubmitForm\b|\/ImportData\b/i,
    label: "Envío de formulario",
    detail:
      "El documento puede enviar o importar datos. Un PDF de factura o contrato no suele necesitar esto.",
    severity: "high",
  },
  {
    id: "uri",
    pattern: /\/URI\b|\/URL\b/i,
    label: "Enlaces dentro del PDF",
    detail:
      "El archivo incluye direcciones web. Por sí solo no es grave, pero conviene no pulsarlas si el correo ya es sospechoso.",
    severity: "medium",
  },
  {
    id: "xfa",
    pattern: /\/XFA\b/i,
    label: "Formulario XFA dinámico",
    detail:
      "Usa formularios XFA, un formato antiguo y con historial de abusos. Mejor no rellenarlo ni activar contenido dinámico.",
    severity: "medium",
  },
  {
    id: "acroform",
    pattern: /\/AcroForm\b/i,
    label: "Campos de formulario",
    detail:
      "Tiene campos rellenables. Es habitual en contratos; solo es raro si nadie te pidió firmar nada.",
    severity: "low",
  },
  {
    id: "rich-media",
    pattern: /\/RichMedia\b|\/3D\b/,
    label: "Contenido multimedia o 3D",
    detail:
      "Incluye multimedia o modelos 3D. No es normal en un PDF de correo laboral y aumenta la superficie de ataque.",
    severity: "medium",
  },
  {
    id: "encrypt",
    pattern: /\/Encrypt\b/,
    label: "PDF cifrado",
    detail:
      "El archivo está cifrado. El análisis estático ve menos de lo habitual; no implica malware, pero reduce la visibilidad.",
    severity: "low",
  },
  {
    id: "objstm",
    pattern: /\/ObjStm\b/,
    label: "Objetos comprimidos",
    detail:
      "Parte de la estructura va en flujos comprimidos (/ObjStm). Eso dificulta ver indicadores a simple vista.",
    severity: "low",
  },
];

export function analyzePdfStatic(raw: string): PdfIndicator[] {
  const source = decodePdfNames(raw);
  const found: PdfIndicator[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(source)) {
      found.push({
        id: rule.id,
        label: rule.label,
        detail: rule.detail,
        severity: rule.severity,
      });
    }
  }

  const urls = source.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? [];
  if (urls.length > 0 && !found.some((item) => item.id === "uri")) {
    found.push({
      id: "plain-url",
      label: "Direcciones web en el contenido",
      detail: `Se vieron ${urls.length} URL en el texto del PDF. No se han abierto. Revisa el dominio antes de copiarlas.`,
      severity: "medium",
    });
  }

  return found;
}

export function isPdfName(name: string, mime: string): boolean {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}
