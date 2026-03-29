import mammoth from 'mammoth';
import JSZip from 'jszip';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const LIBREOFFICE_DETECT_RETRY_MS = 45_000;
/** Puppeteer path: DOCX→HTML + print can exceed 30s on large templates (especially Windows). */
const PUPPETEER_PDF_TIMEOUT_MS = 300_000;

/** OOXML parts that can contain floating pictures / watermarks */
const DOCX_XML_STRIP_OUTLINE_RE =
  /^word\/(document\.xml|(header|footer)\d*\.xml|footnotes\.xml|endnotes\.xml)$/i;

function stripDrawingMlOutlinesInXml(xml) {
  const stripALn = (fragment) =>
    fragment
      .replace(/<a:ln\b[^>]*\/>/gi, '')
      .replace(/<a:ln\b[^>]*>[\s\S]*?<\/a:ln>/gi, '');

  return (
    xml
      // Picture shape outline (common cause of a black box around watermark images in PDF export)
      .replace(/<pic:spPr(\b[^>]*)>([\s\S]*?)<\/pic:spPr>/gi, (_, attrs, inner) => {
        return `<pic:spPr${attrs}>${stripALn(inner)}</pic:spPr>`;
      })
      // Wordprocessing shape properties (some templates use this instead of pic:spPr)
      .replace(/<wps:spPr(\b[^>]*)>([\s\S]*?)<\/wps:spPr>/gi, (_, attrs, inner) => {
        return `<wps:spPr${attrs}>${stripALn(inner)}</wps:spPr>`;
      })
  );
}

/** Any DrawingML-style "ln" outline (a:ln, a14:ln, …) — catches outlines not under pic:spPr. */
function stripAllDrawingLnElements(xml) {
  return xml
    .replace(/<a\w*:ln\b[^>]*\/>/gi, '')
    .replace(/<a\w*:ln\b[^>]*>[\s\S]*?<\/a\w*:ln>/gi, '');
}

/** Legacy VML picture strokes (Word 97–2003 compatibility / some watermarks). */
function stripVmlStrokes(xml) {
  if (!/<\/?v:/i.test(xml)) return xml;
  return (
    xml
      .replace(/<v:stroke\b[^>]*\/?>/gi, '')
      .replace(/(<v:(?:shape|rect|oval|line|arc|roundrect|image)\b)([^>]*)(>)/gi, (_m, open, attrs, gt) => {
        let a = String(attrs)
          .replace(/\s+stroked="(?:t|true|1)"/gi, ' stroked="f"')
          .replace(/\s+stroke="\s*1\s*"/gi, ' stroke="0"')
          .replace(/\s+strokecolor="[^"]*"/gi, ' strokecolor="#ffffff"');
        if (!/\bstroked=/i.test(a)) a += ' stroked="f"';
        return `${open}${a}${gt}`;
      })
  );
}

function stripWatermarkOutlinesInXml(xml) {
  let out = stripDrawingMlOutlinesInXml(xml);
  out = stripAllDrawingLnElements(out);
  out = stripVmlStrokes(out);
  return out;
}

/**
 * Remove picture/shape outlines from DOCX before LibreOffice → PDF.
 * LibreOffice often draws `<a:ln>` (even hairline) as a visible rectangle around semi‑transparent watermarks.
 *
 * @param {Buffer} docxBuffer
 * @returns {Promise<Buffer>}
 */
async function stripWatermarkImageOutlinesFromDocx(docxBuffer) {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    let changed = false;
    const tasks = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir || !DOCX_XML_STRIP_OUTLINE_RE.test(relPath)) return;
      tasks.push(
        (async () => {
          const f = zip.file(relPath);
          if (!f) return;
          const content = await f.async('string');
          const next = stripWatermarkOutlinesInXml(content);
          if (next !== content) {
            zip.file(relPath, next);
            changed = true;
          }
        })()
      );
    });
    await Promise.all(tasks);
    if (!changed) return docxBuffer;
    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  } catch {
    return docxBuffer;
  }
}

// ─── LibreOffice detection ────────────────────────────────────────────────────

function normalizeWindowsExe(p) {
  let t = (p || '').trim();
  // dotenv often leaves surrounding quotes (e.g. LIBREOFFICE_PATH="C:\\Program Files\\...\\soffice.exe")
  // which breaks execFile. Remove them.
  t = t.replace(/^["']+|["']+$/g, '');
  // If the .env value was written with escaped backslashes (e.g. C:\\Program Files\\...),
  // normalize repeated '\' characters in drive-letter paths.
  if (/^[a-zA-Z]:/.test(t)) {
    t = t.replace(/\\+/g, '\\');
  }
  if (!t || process.platform !== 'win32') return t;
  if (/\.(exe|com|bat|cmd)$/i.test(t)) return t;
  return `${t}.exe`;
}

function getSofficeCandidates() {
  /** @type {string[]} */
  const list = [];
  const fromEnv = normalizeWindowsExe(process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH || '');
  if (fromEnv) list.push(fromEnv);

  const pf = process.env.ProgramFiles;
  const pf86 = process.env['ProgramFiles(x86)'];
  if (pf) list.push(path.join(pf, 'LibreOffice', 'program', 'soffice.exe'));
  if (pf86) list.push(path.join(pf86, 'LibreOffice', 'program', 'soffice.exe'));

  list.push(
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  );
  list.push('soffice');

  return [...new Set(list)];
}

/** Windows: find `soffice.exe` when LibreOffice added itself to PATH only. */
async function findSofficeViaWhere() {
  if (process.platform !== 'win32') return null;
  const whereExe = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'where.exe')
    : 'where.exe';
  try {
    const { stdout } = await execFileAsync(whereExe, ['soffice'], {
      timeout: 8000,
      windowsHide: true,
    });
    const line = stdout
      .trim()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /\.(exe|com)$/i.test(s));
    return line || null;
  } catch {
    return null;
  }
}

let _libreOfficePath = null;
/** When non-null, skip rescanning for a short interval (LibreOffice may be installed mid-session). */
let _libreOfficeLastMissAt = 0;
let _libreOfficeDetectPromise = null;

async function detectLibreOffice() {
  if (_libreOfficePath) return _libreOfficePath;
  const now = Date.now();
  if (_libreOfficeLastMissAt && now - _libreOfficeLastMissAt < LIBREOFFICE_DETECT_RETRY_MS) {
    return null;
  }
  if (_libreOfficeDetectPromise) return _libreOfficeDetectPromise;

  _libreOfficeDetectPromise = (async () => {
    try {
      const candidates = getSofficeCandidates();
      for (const candidate of candidates) {
        // Checking existence is fast and avoids hanging on `--version` (seen on Windows).
        const looksLikePath =
          /^[a-zA-Z]:[\\/]/.test(candidate) || candidate.includes('\\') || candidate.includes('/');
        if (!looksLikePath) continue;

        try {
          await fs.stat(candidate);
          _libreOfficePath = candidate;
          console.log('[docxToPdf] LibreOffice found at:', candidate);
          return _libreOfficePath;
        } catch {
          // try next
        }
      }

      const fromWhere = await findSofficeViaWhere();
      if (fromWhere) {
        _libreOfficePath = fromWhere;
        console.log('[docxToPdf] LibreOffice found on PATH:', fromWhere);
        return _libreOfficePath;
      }

      _libreOfficeLastMissAt = Date.now();
      console.log(
        '[docxToPdf] LibreOffice not found — PDF uses HTML preview (slow; watermarks/layout may be lost). ' +
          'Install: https://www.libreoffice.org/download/ then restart the API, or set LIBREOFFICE_PATH to soffice.exe'
      );
      return null;
    } finally {
      _libreOfficeDetectPromise = null;
    }
  })();

  return _libreOfficeDetectPromise;
}

// Warm cache before first request (failures still allow retries later).
void detectLibreOffice();

/** LibreOffice file URL for -env:UserInstallation (avoids clashes with a running GUI). */
function pathToLibreOfficeFileUrl(absPath) {
  const normalized = path.resolve(absPath).replace(/\\/g, '/');
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file:///${normalized}`;
}

// ─── LibreOffice PDF conversion ───────────────────────────────────────────────

/**
 * @param {Buffer} docxBuffer
 * @param {{ useIsolatedProfile?: boolean }} opts
 *   Isolated UserInstallation avoids clashes with a running LibreOffice GUI, but on some Windows
 *   setups headless PDF conversion fails silently or drops layout; we retry without it.
 */
async function libreOfficeToPdf(docxBuffer, opts = {}) {
  const { useIsolatedProfile = true } = opts;
  const sofficePath = _libreOfficePath || (await detectLibreOffice());
  if (!sofficePath) throw new Error('LibreOffice not available');

  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const profileDir = path.join(tmpDir, `lo_conv_${id}`);
  const docxFile = path.join(tmpDir, `gluck_${id}.docx`);
  const pdfFile = path.join(tmpDir, `gluck_${id}.pdf`);

  const baseArgs = [
    '--headless',
    '--invisible',
    '--norestore',
    '--nofirststartwizard',
    '--nologo',
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    tmpDir,
    docxFile,
  ];
  const args = useIsolatedProfile
    ? [`-env:UserInstallation=${pathToLibreOfficeFileUrl(profileDir)}`, ...baseArgs]
    : baseArgs;

  const execOpts = { timeout: 240_000, maxBuffer: 50 * 1024 * 1024, windowsHide: true };

  try {
    if (useIsolatedProfile) await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(docxFile, docxBuffer);

    const { stderr } = await execFileAsync(sofficePath, args, execOpts);
    const errText = stderr?.toString?.()?.trim?.() || '';
    if (errText) {
      console.log('[docxToPdf] LibreOffice stderr (informational):', errText.slice(0, 4000));
    }

    const st = await fs.stat(pdfFile).catch(() => null);
    if (!st?.size) throw new Error('LibreOffice did not produce a PDF file');

    const pdfBuffer = await fs.readFile(pdfFile);
    return pdfBuffer;
  } finally {
    await fs.unlink(docxFile).catch(() => {});
    await fs.unlink(pdfFile).catch(() => {});
    if (useIsolatedProfile) {
      await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ─── Puppeteer singleton browser ─────────────────────────────────────────────

let _browser = null;
let _browserLaunching = null;

const PUPPETEER_LAUNCH_OPTS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    // --single-process breaks or slows Chrome heavily on Windows; keep off there.
    ...(process.platform === 'win32' ? [] : ['--single-process']),
  ],
};

function resetBrowser() {
  _browser = null;
  _browserLaunching = null;
}

async function getBrowser() {
  if (_browser) {
    try {
      // Quick health-check: a disconnected browser throws here.
      await _browser.version();
      return _browser;
    } catch {
      resetBrowser();
    }
  }

  if (_browserLaunching) return _browserLaunching;

  const puppeteer = await import('puppeteer');
  _browserLaunching = puppeteer.default
    .launch(PUPPETEER_LAUNCH_OPTS)
    .then((b) => {
      _browser = b;
      _browserLaunching = null;
      b.on('disconnected', resetBrowser);
      return b;
    })
    .catch((err) => {
      resetBrowser();
      throw err;
    });

  return _browserLaunching;
}

async function puppeteerToPdf(docxBuffer) {
  console.warn(
    '[docxToPdf] Using Mammoth + Puppeteer — only body text is printed; headers, watermarks, and letterhead are omitted. ' +
      'Fix LibreOffice conversion (see prior log lines) for full layout.'
  );
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });

  const wrapped = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  p { margin: 0 0 10px 0; line-height: 1.45; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px 6px; font-size: 10pt; }
  img { max-width: 100%; height: auto; }
</style></head><body>${html}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(wrapped, {
      waitUntil: 'domcontentloaded',
      timeout: PUPPETEER_PDF_TIMEOUT_MS,
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
      timeout: PUPPETEER_PDF_TIMEOUT_MS,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a DOCX buffer → PDF buffer.
 *
 * Strategy:
 *   1. If LibreOffice is available → use it (preserves watermarks, images, exact layout).
 *   2. Otherwise → Mammoth (DOCX→HTML) + singleton Puppeteer browser.
 *
 * @param {Buffer} docxBuffer
 * @returns {Promise<Buffer>}
 */
export async function docxBufferToPdf(docxBuffer) {
  const prepared = await stripWatermarkImageOutlinesFromDocx(docxBuffer);

  const sofficePath = _libreOfficePath ?? (await detectLibreOffice());

  const skipIsolated = process.env.LIBREOFFICE_SKIP_ISOLATED_PROFILE === '1';

  if (sofficePath) {
    const tryLo = async (isolated) => {
      const buf = await libreOfficeToPdf(prepared, { useIsolatedProfile: isolated });
      console.log(`[docxToPdf] PDF via LibreOffice (${buf.length} bytes, isolatedProfile=${isolated})`);
      return buf;
    };
    try {
      if (skipIsolated) return await tryLo(false);
      try {
        return await tryLo(true);
      } catch (err1) {
        console.warn('[docxToPdf] LibreOffice (isolated profile) failed:', err1?.message);
        return await tryLo(false);
      }
    } catch (err) {
      console.warn('[docxToPdf] LibreOffice conversion failed, falling back to Puppeteer:', err?.message);
    }
  } else {
    console.warn('[docxToPdf] LibreOffice not available — using Puppeteer; set LIBREOFFICE_PATH if needed.');
  }

  return puppeteerToPdf(prepared);
}
