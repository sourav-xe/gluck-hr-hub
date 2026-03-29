import JSZip from 'jszip';

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fixBrokenAlignment(xml) {
  let result = xml.replace(/<w:jc\s+w:val=["']distribute["']\s*\/>/gi, '<w:jc w:val="left"/>');

  result = result.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const isHeadingStyle = /<w:pStyle\s+w:val=["'][^"']*Heading[^"']*["']/i.test(para);
    const hasBold = /<w:b(?:\s*\/?>|\s+w:val=["'](?:true|1)["'][^>]*\/?>)/i.test(para);
    const hasProblemAlignment = /<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/i.test(para);
    const hasTabRuns = /<w:tab\s*\/>/i.test(para);

    const textContent = (para.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    const looksLikeShortHeading = /^([\d.]+\s*)?[A-Z][^.!?]{0,140}$/.test(textContent);
    const shouldNormalize =
      isHeadingStyle || looksLikeShortHeading || (hasBold && (textContent.length < 120 || hasTabRuns || hasProblemAlignment));
    if (!shouldNormalize) return para;

    let updated = para;
    updated = updated.replace(/<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/gi, '<w:jc w:val="left"/>');
    updated = updated.replace(/<w:tab\s*\/>/gi, '<w:t xml:space="preserve"> </w:t>');

    if (/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/i.test(updated)) {
      updated = updated.replace(/<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/i, (_match, attrs, content) => {
        if (/<w:jc\b/i.test(content)) {
          return `<w:pPr${attrs}>${content.replace(/<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/gi, '<w:jc w:val="left"/>')}</w:pPr>`;
        }
        return `<w:pPr${attrs}>${content}<w:jc w:val="left"/></w:pPr>`;
      });
    } else {
      updated = updated.replace(/<w:p\b([^>]*)>/i, '<w:p$1><w:pPr><w:jc w:val="left"/></w:pPr>');
    }

    return updated;
  });

  return result;
}

function replaceRedTextInXml(xml, fieldValues) {
  let result = fixBrokenAlignment(xml);
  for (const [placeholder, value] of Object.entries(fieldValues || {})) {
    if (!value) continue;
    const regex = new RegExp(
      `(<w:r\\b[^>]*>)((?:<w:rPr>[\\s\\S]*?<w:color\\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["'][\\s\\S]*?<\\/w:rPr>)[\\s\\S]*?)(<w:t[^>]*>)(${escapeRegex(placeholder)})(<\\/w:t>)`,
      'g'
    );
    result = result.replace(regex, (_, runStart, rprContent, tStart, _text, tEnd) => {
      const updatedRpr = rprContent.replace(
        /<w:color\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["']\s*\/>/gi,
        '<w:color w:val="000000"/>'
      );
      return `${runStart}${updatedRpr}${tStart}${value}${tEnd}`;
    });
  }
  return result;
}

/**
 * @param {Buffer} docxBuffer
 * @param {Record<string, string>} fieldValues placeholder (red snippet) -> replacement
 * @returns {Promise<Buffer>}
 */
export async function mergeSimpleDocxTemplate(docxBuffer, fieldValues) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const xmlFiles = ['word/document.xml'];
  zip.forEach((path) => {
    if (/^word\/(header|footer)\d*\.xml$/.test(path)) xmlFiles.push(path);
  });
  for (let i = 0; i < xmlFiles.length; i++) {
    const xmlFile = xmlFiles[i];
    const content = await zip.file(xmlFile)?.async('string');
    if (content) {
      zip.file(xmlFile, replaceRedTextInXml(content, fieldValues));
    }
  }
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return out;
}
