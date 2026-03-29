import PizZip from 'pizzip';

/** Word / common theme reds — extend as needed */
const RED_HEX = new Set([
  'FF0000',
  'C00000',
  'C0504D',
  'FF3333',
  'E74C3C',
  'C45911',
  '943634',
  '9C0006',
]);

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function encodeXmlText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function runHasRed(runXml) {
  const m = runXml.match(/<w:color\b[^>]*w:val="([^"]+)"/);
  if (!m) return false;
  const v = m[1].toUpperCase();
  if (RED_HEX.has(v)) return true;
  if (v.length === 6 && /^[0-9A-F]+$/.test(v)) {
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    if (r > 180 && g < 120 && b < 120) return true;
  }
  return false;
}

function textFromRun(runXml) {
  const parts = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(runXml)) !== null) {
    parts.push(decodeXmlEntities(m[1]));
  }
  return parts.join('');
}

/**
 * Extract distinct {{mustache}} keys and red-colored text runs from DOCX.
 * @param {Buffer} docxBuffer
 */
export function analyzeDocxPlaceholders(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  const file = zip.file('word/document.xml');
  if (!file) return { mustacheKeys: [], redSnippets: [] };
  const xml = file.asText();

  const mustacheKeys = new Set();
  const mustacheRe = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let mm;
  while ((mm = mustacheRe.exec(xml)) !== null) {
    mustacheKeys.add(mm[1]);
  }

  const redSnippets = [];
  const seen = new Set();
  const runRe = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
  let rm;
  while ((rm = runRe.exec(xml)) !== null) {
    const run = rm[0];
    if (!runHasRed(run)) continue;
    const text = textFromRun(run).trim();
    if (!text || text.startsWith('{{')) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    redSnippets.push(text);
  }

  return {
    mustacheKeys: Array.from(mustacheKeys),
    redSnippets,
  };
}

/**
 * Replace first exact match of red snippet inside red runs with {{key}} (XML-safe).
 * Best-effort: same limitations as manual merge if Word splits runs.
 * @param {Buffer} docxBuffer
 * @param {{ key: string, redSnippet: string }[]} mappings
 */
function wordXmlPartNames(zip) {
  return Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && /^word\/(document|header\d*|footer\d*)\.xml$/i.test(n)
  );
}

function materializeRedSnippetsInXml(xml, mappings) {
  const sorted = [...mappings]
    .filter((m) => m.key && m.redSnippet)
    .sort((a, b) => b.redSnippet.length - a.redSnippet.length);

  for (const { key, redSnippet } of sorted) {
    const needle = encodeXmlText(redSnippet);
    const replacement = `{{${key}}}`;
    const runRe = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
    let replaced = false;
    xml = xml.replace(runRe, (run) => {
      if (replaced || !runHasRed(run)) return run;
      if (!run.includes('<w:t') || !run.includes(`>${needle}</w:t>`)) return run;
      const next = run.replace(`>${needle}</w:t>`, `>${encodeXmlText(replacement)}</w:t>`);
      replaced = true;
      return next;
    });
  }
  return xml;
}

export function materializeRedSnippetsToMustache(docxBuffer, mappings) {
  const zip = new PizZip(docxBuffer);
  const names = wordXmlPartNames(zip);
  if (names.length === 0) throw new Error('Invalid DOCX: no word/document or header/footer XML');
  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    let xml = entry.asText();
    xml = materializeRedSnippetsInXml(xml, mappings);
    zip.file(name, xml);
  }
  return zip.generate({ type: 'nodebuffer' });
}

function normWs(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceRunTextNodes(runXml, newPlainText) {
  const enc = encodeXmlText(newPlainText);
  let first = true;
  return runXml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, () => {
    if (!first) return '';
    first = false;
    return `<w:t xml:space="preserve">${enc}</w:t>`;
  });
}

/**
 * Replace literal text inside **red** runs with user values (same layout/colour).
 * Skips snippets that look like mustache (handled by docxtemplater).
 * Uses redSnippet, or label as fallback when redSnippet is empty.
 * @param {Buffer} docxBuffer
 * @param {Array<{ key: string, redSnippet?: string, label?: string }>} placeholders
 * @param {Record<string, string>} values
 */
export function replaceRedPlaceholderValuesInDocx(docxBuffer, placeholders, values) {
  const zip = new PizZip(docxBuffer);
  const names = wordXmlPartNames(zip);
  if (names.length === 0) return docxBuffer;

  const items = (placeholders || [])
    .map((p) => {
      const snippet = String(p.redSnippet || '').trim() || String(p.label || '').trim();
      const key = String(p.key || '').trim();
      if (!key || !snippet) return null;
      if (snippet.startsWith('{{')) return null;
      const v = values[key];
      const value = v === undefined || v === null ? '' : String(v);
      return { snippet, value, normSnippet: normWs(snippet) };
    })
    .filter(Boolean)
    .sort((a, b) => b.snippet.length - a.snippet.length);

  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    let xml = entry.asText();
    xml = xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
      if (!runHasRed(run)) return run;
      const text = textFromRun(run);
      const nText = normWs(text);
      for (const item of items) {
        if (!item) continue;
        if (nText === item.normSnippet || text.trim() === item.snippet) {
          return replaceRunTextNodes(run, item.value);
        }
      }
      return run;
    });
    zip.file(name, xml);
  }

  return zip.generate({ type: 'nodebuffer' });
}
