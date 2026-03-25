import mammoth from 'mammoth';

/**
 * Convert DOCX buffer → PDF using Mammoth (HTML) + Puppeteer.
 * Puppeteer is loaded dynamically so installs without Chromium still allow DOCX export.
 * @param {Buffer} docxBuffer
 * @param {object} [opts]
 * @param {import('puppeteer').LaunchOptions} [opts.launchOptions]
 */
export async function docxBufferToPdf(docxBuffer, opts = {}) {
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });

  const puppeteer = await import('puppeteer');
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...opts.launchOptions,
  };

  let browser;
  try {
    browser = await puppeteer.default.launch(launchOptions);
    const page = await browser.newPage();
    const wrapped = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #111; padding: 24px; max-width: 800px; margin: 0 auto; }
  p { margin: 0 0 10px 0; line-height: 1.45; }
</style></head><body>${html}</body></html>`;
    await page.setContent(wrapped, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
    });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}
