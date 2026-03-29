import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DOC_AUTOMATION_ROOT = path.join(__dirname, '..', 'storage', 'document-automation');

export function templateDir(storageDir) {
  return path.join(DOC_AUTOMATION_ROOT, 'templates', storageDir);
}

export function templateOriginalPath(storageDir) {
  return path.join(templateDir(storageDir), 'original.docx');
}

export function templateWorkingPath(storageDir) {
  return path.join(templateDir(storageDir), 'working.docx');
}

export function templateOriginalExtPath(storageDir, ext) {
  const e = String(ext || 'docx').replace('.', '').toLowerCase();
  return path.join(templateDir(storageDir), `original.${e}`);
}

export function generatedRunDir(runId) {
  return path.join(DOC_AUTOMATION_ROOT, 'generated', runId);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readWorkingTemplateBuffer(storageDir) {
  const working = templateWorkingPath(storageDir);
  return fs.readFile(working);
}

export async function writeBuffer(filePath, buf) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buf);
}
