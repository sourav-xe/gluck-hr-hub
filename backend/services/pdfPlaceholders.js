import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function extractToken(keyMatch) {
  const k1 = keyMatch[1];
  const k2 = keyMatch[2];
  return String(k1 || k2 || '').trim();
}

function tokenRegex() {
  // `{{key}}` or `<<key>>`
  return /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\<\<\s*([a-zA-Z0-9_]+)\s*\>\>/g;
}

function normalizeTokenKey(k) {
  return String(k || '').trim().replace(/\s+/g, '_');
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Heuristic: PDF "red" dynamic text (fill/stroke RGB), not blue watermark / black body. */
function isReddishFill(hex) {
  if (!hex || hex === 'transparent') return false;
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  if (r < 110) return false;
  if (r < g + 45) return false;
  if (r < b + 45) return false;
  return true;
}

/** PDF text rendering mode (Tr): 0 fill, 1 stroke, 2 fill then stroke, … */
function isSegmentRedByTextMode(fillHex, strokeHex, textMode) {
  const m = Number(textMode) || 0;
  if (m === 1 || m === 5) return isReddishFill(strokeHex);
  if (m === 0 || m === 4) return isReddishFill(fillHex);
  if (m === 2 || m === 6) return isReddishFill(fillHex) || isReddishFill(strokeHex);
  return isReddishFill(fillHex);
}

function glyphsToUnicodeString(glyphs) {
  if (!Array.isArray(glyphs)) return '';
  let out = '';
  for (const g of glyphs) {
    if (g == null) continue;
    if (typeof g === 'number') continue;
    if (typeof g === 'object') {
      if (g.fontChar) out += g.fontChar;
      else if (g.unicode !== undefined) {
        const u = g.unicode;
        out += typeof u === 'number' ? String.fromCharCode(u) : String(u);
      }
    }
  }
  return out;
}

/**
 * Walk display operator list: track fill color and capture text shown with each fill.
 * pdf.js text items do not include color; this mirrors how the page is painted.
 */
async function extractColoredTextSegmentsFromPage(page) {
  const opList = await page.getOperatorList({ intent: 'display' });
  const { fnArray, argsArray } = opList;
  let fillHex = '#000000';
  let strokeHex = '#000000';
  let textMode = 0;
  /** @type {{ fillHex: string, strokeHex: string, textMode: number }[]} */
  const stack = [];
  /** @type {{ fillHex: string, strokeHex: string, textMode: number, text: string }[]} */
  const segments = [];

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];
    switch (fn) {
      case OPS.save:
        stack.push({ fillHex, strokeHex, textMode });
        break;
      case OPS.restore: {
        const prev = stack.pop();
        if (prev) {
          fillHex = prev.fillHex;
          strokeHex = prev.strokeHex;
          textMode = prev.textMode;
        } else {
          fillHex = '#000000';
          strokeHex = '#000000';
          textMode = 0;
        }
        break;
      }
      case OPS.setFillRGBColor:
        if (args[0]) fillHex = args[0];
        break;
      case OPS.setStrokeRGBColor:
        if (args[0]) strokeHex = args[0];
        break;
      case OPS.setFillTransparent:
        fillHex = 'transparent';
        break;
      case OPS.setStrokeTransparent:
        strokeHex = 'transparent';
        break;
      case OPS.setTextRenderingMode:
        if (typeof args[0] === 'number') textMode = args[0];
        break;
      case OPS.showText: {
        const text = glyphsToUnicodeString(args[0]);
        if (text) segments.push({ fillHex, strokeHex, textMode, text });
        break;
      }
      default:
        break;
    }
  }
  return segments;
}

function segmentPaintKey(fillHex, strokeHex, textMode) {
  return `${fillHex}|${strokeHex}|${textMode}`;
}

function mergeAdjacentSamePaintSegments(segments) {
  /** @type {{ fillHex: string, strokeHex: string, textMode: number, text: string }[]} */
  const out = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && segmentPaintKey(last.fillHex, last.strokeHex, last.textMode) === segmentPaintKey(seg.fillHex, seg.strokeHex, seg.textMode)) {
      last.text += seg.text;
    } else out.push({ ...seg });
  }
  return out;
}

/**
 * @returns {Promise<{ pageNum: number, text: string, fillHex: string }[]>}
 */
async function extractRedTextRunsFromPdf(pdfBuffer) {
  const loadingTask = getDocument({ data: pdfBytesToUint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  /** @type {{ pageNum: number, text: string, fillHex: string }[]} */
  const runs = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const raw = await extractColoredTextSegmentsFromPage(page);
    const merged = mergeAdjacentSamePaintSegments(raw);
    for (const m of merged) {
      if (!isSegmentRedByTextMode(m.fillHex, m.strokeHex, m.textMode)) continue;
      const text = m.text.replace(/\u00a0/g, ' ');
      const trimmed = text.trim();
      if (trimmed.length < 2) continue;
      if (!/[\p{L}\p{N}]/u.test(trimmed)) continue;
      runs.push({ pageNum, text, fillHex: m.fillHex, strokeHex: m.strokeHex, textMode: m.textMode });
    }
  }
  return runs;
}

function keyFromRedRun(snippet, idx, usedKeys) {
  let base = normalizeTokenKey(
    snippet
      .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
      .trim()
      .slice(0, 48)
      .replace(/\s+/g, '_')
  );
  if (base.length < 2) base = `pdf_red_${idx + 1}`;
  let key = base;
  let n = 0;
  while (usedKeys.has(key)) {
    n += 1;
    key = `${base}_${n}`;
  }
  usedKeys.add(key);
  return key;
}

function findItemPositionForSnippet(pageItems, snippet) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const target = norm(snippet);
  if (!target) return null;
  for (const it of pageItems) {
    const s = norm(it.str || '');
    if (!s) continue;
    if (s === target || s.includes(target) || target.includes(s)) {
      const x = it.transform.e;
      const yPdf = it.transform.f;
      const pageHeight = it.viewportHeight || 0;
      const y =
        pageHeight && (yPdf < 0 || yPdf > pageHeight + 50) ? pageHeight - yPdf : yPdf;
      return { str: it.str, x, y, height: it.height || 10 };
    }
  }
  return null;
}

/** pdfjs-dist v5+ rejects Node Buffer; it must be a plain Uint8Array. */
function pdfBytesToUint8Array(pdfBuffer) {
  if (pdfBuffer instanceof Uint8Array && !Buffer.isBuffer(pdfBuffer)) {
    return pdfBuffer;
  }
  return new Uint8Array(pdfBuffer);
}

async function extractPdfTextItems(pdfBuffer) {
  const loadingTask = getDocument({ data: pdfBytesToUint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const items = [];
    for (const item of textContent.items || []) {
      // item.transform: [a, b, c, d, e, f]
      const [a, b, c, d, e, f] = item.transform || [1, 0, 0, 1, 0, 0];
      items.push({
        str: String(item.str || ''),
        transform: { a, b, c, d, e, f },
        width: item.width || 0,
        height: item.height || Math.abs(d) || 10,
        viewportHeight: viewport?.height || 0,
      });
    }

    pages.push({ pageNum, items });
  }

  return pages;
}

/**
 * Detect placeholders: `{{key}}` / `<<key>>` in text, plus **red fill** text via operator-list colors.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{
 *   keys: string[],
 *   occurrences: Array<{ key: string, pageNum: number, str: string, x: number, y: number, height: number }>,
 *   mustacheKeys: string[],
 *   redSnippets: string[],
 *   suggestions: Array<{ key: string, label: string, source: string, exampleValue: string, redSnippet: string }>
 * }>}
 */
export async function analyzePdfPlaceholders(pdfBuffer) {
  const tokenRe = tokenRegex();
  const pages = await extractPdfTextItems(pdfBuffer);

  const keySet = new Set();
  const usedKeys = new Set();
  const occurrences = [];
  /** @type {string[]} */
  const mustacheKeys = [];
  /** @type {Array<{ key: string, label: string, source: string, exampleValue: string, redSnippet: string }>} */
  const suggestions = [];

  for (const p of pages) {
    for (const it of p.items) {
      const str = it.str || '';
      tokenRe.lastIndex = 0;
      let m;
      while ((m = tokenRe.exec(str)) !== null) {
        const key = normalizeTokenKey(extractToken(m));
        if (!key) continue;
        if (!keySet.has(key)) {
          keySet.add(key);
          usedKeys.add(key);
          mustacheKeys.push(key);
          suggestions.push({
            key,
            label: key.replace(/_/g, ' '),
            source: 'mustache',
            exampleValue: '',
            redSnippet: `{{${key}}}`,
          });
        }

        const x = it.transform.e;
        const yPdf = it.transform.f;
        const pageHeight = it.viewportHeight || 0;
        const y = pageHeight && (yPdf < 0 || yPdf > pageHeight + 50) ? pageHeight - yPdf : yPdf;

        occurrences.push({
          key,
          pageNum: p.pageNum,
          str: it.str,
          x,
          y,
          height: it.height || 10,
        });
      }
    }
  }

  const redRuns = await extractRedTextRunsFromPdf(pdfBuffer);
  /** @type {string[]} */
  const redSnippets = [];

  let redIdx = 0;
  for (const run of redRuns) {
    const snippet = run.text.trim();
    if (!snippet) continue;
    redSnippets.push(snippet);
    const key = keyFromRedRun(snippet, redIdx, usedKeys);
    redIdx += 1;
    keySet.add(key);
    suggestions.push({
      key,
      label: snippet.length > 72 ? `${snippet.slice(0, 69)}…` : snippet,
      source: 'red',
      exampleValue: snippet,
      redSnippet: snippet,
    });
    const page = pages.find((x) => x.pageNum === run.pageNum);
    const pos = page ? findItemPositionForSnippet(page.items, snippet) : null;
    if (pos) {
      occurrences.push({
        key,
        pageNum: run.pageNum,
        str: pos.str,
        x: pos.x,
        y: pos.y,
        height: pos.height || 10,
      });
    }
  }

  return {
    keys: Array.from(keySet),
    occurrences,
    mustacheKeys,
    redSnippets,
    suggestions,
  };
}

/**
 * Fill placeholder tokens on a PDF template by drawing typed values where the token text is.
 * BEST-EFFORT: layout matching depends on PDF text extraction accuracy and fonts.
 *
 * @param {Buffer} pdfBuffer
 * @param {Record<string, string>} values
 * @returns {Promise<Buffer>}
 */
export async function fillPdfTemplateWithPlaceholders(pdfBuffer, values) {
  const filledValues = values || {};
  const { occurrences } = await analyzePdfPlaceholders(pdfBuffer);

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageIndexByNum = new Map();
  for (let i = 0; i < pdfDoc.getPages().length; i += 1) {
    pageIndexByNum.set(i + 1, i);
  }

  // Group occurrences by page to reduce repeated getPage calls.
  const byPage = new Map();
  for (const occ of occurrences) {
    if (!byPage.has(occ.pageNum)) byPage.set(occ.pageNum, []);
    byPage.get(occ.pageNum).push(occ);
  }

  for (const [pageNum, occList] of byPage.entries()) {
    const pageIdx = pageIndexByNum.get(pageNum);
    const page = pdfDoc.getPage(pageIdx);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    for (const occ of occList) {
      const v = filledValues[occ.key];
      if (v === undefined || v === null) continue;
      const value = String(v);

      const fontSize = Math.max(6, Number(occ.height) || 10);

      // Approximate rectangle around placeholder text.
      const approxWidth = font.widthOfTextAtSize(value, fontSize);
      const rectW = Math.max(approxWidth + 6, occ.str?.length ? font.widthOfTextAtSize(occ.str, fontSize) : 60);
      const rectH = fontSize * 1.15;

      const rectX = Math.max(0, occ.x - 1);
      const rectY = Math.max(0, occ.y - rectH + 2);

      // Cover existing placeholder text.
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
        color: rgb(1, 1, 1),
      });

      // Draw replacement text.
      page.drawText(value, {
        x: rectX,
        y: rectY + rectH * 0.15,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  return Buffer.from(await pdfDoc.save());
}

