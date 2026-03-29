const KEY = 'gluck_hr_email_draft';

type StashPayload = { fileName: string; mime: string; base64: string; savedAt: number };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

/** Store merged document from Auto-Docs “Draft download” for Announcements → attach. */
export async function writeEmailDraftStash(blob: Blob, fileName: string): Promise<void> {
  const mime = blob.type || 'application/octet-stream';
  const base64 = await blobToBase64(blob);
  const payload: StashPayload = { fileName, mime, base64, savedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function readEmailDraftStashMeta(): { fileName: string; savedAt: number } | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StashPayload;
    if (!p?.fileName || !p?.base64) return null;
    return { fileName: p.fileName, savedAt: p.savedAt };
  } catch {
    return null;
  }
}

export function fileFromEmailDraftStash(): File | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StashPayload;
    if (!p?.fileName || !p?.base64) return null;
    const blob = base64ToBlob(p.base64, p.mime);
    return new File([blob], p.fileName, { type: p.mime || blob.type });
  } catch {
    return null;
  }
}

export function clearEmailDraftStash(): void {
  sessionStorage.removeItem(KEY);
}
