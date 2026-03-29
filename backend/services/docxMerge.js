import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

/**
 * Merge a DOCX (with {{placeholders}}) using docxtemplater.
 * @param {Buffer} templateBuffer
 * @param {Record<string, string | number | null | undefined>} data
 * @returns {Buffer}
 */
export function mergeDocxTemplate(templateBuffer, data) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter() {
      return '';
    },
  });
  const normalized = {};
  for (const [k, v] of Object.entries(data || {})) {
    normalized[k] = v === null || v === undefined ? '' : String(v);
  }
  doc.render(normalized);
  return doc.getZip().generate({ type: 'nodebuffer' });
}
