import { apiFetch, getApiBaseUrl, loadStoredAuth } from '@/lib/api';
import type { DocumentAutomationRunRow, DocumentTemplateRow, DocPlaceholderRow } from '@/types/hr';

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function fetchDocumentTemplates(): Promise<DocumentTemplateRow[]> {
  const res = await apiFetch('/api/document-automation/templates');
  if (!res.ok) return [];
  return await parseJson<DocumentTemplateRow[]>(res);
}

export async function fetchDocumentTemplate(id: string): Promise<DocumentTemplateRow | null> {
  const res = await apiFetch(`/api/document-automation/templates/${id}`);
  if (!res.ok) return null;
  return await parseJson<DocumentTemplateRow>(res);
}

export async function uploadDocumentTemplate(
  file: File,
  meta: { name: string; description?: string; category?: string }
): Promise<DocumentTemplateRow | null> {
  const auth = loadStoredAuth();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', meta.name);
  if (meta.description) fd.append('description', meta.description);
  if (meta.category) fd.append('category', meta.category);
  const headers = new Headers();
  if (auth?.token) headers.set('Authorization', `Bearer ${auth.token}`);
  const base = getApiBaseUrl();
  const url = `${base}/api/document-automation/templates`;
  const res = await fetch(url, { method: 'POST', body: fd, headers });
  if (!res.ok) return null;
  return await parseJson<DocumentTemplateRow>(res);
}

export async function patchDocumentTemplate(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    category: string;
    status: 'draft' | 'active';
    placeholders: DocPlaceholderRow[];
    commitMappings: boolean;
  }>
): Promise<DocumentTemplateRow | null> {
  const res = await apiFetch(`/api/document-automation/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return await parseJson<DocumentTemplateRow>(res);
}

export async function deleteDocumentTemplate(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/document-automation/templates/${id}`, { method: 'DELETE' });
  return res.ok;
}

export type DetectResult = {
  suggestions: DocPlaceholderRow[];
  mustacheKeys: string[];
  redSnippets: string[];
  aiEnabled: boolean;
};

export async function detectDocumentPlaceholders(id: string, useAi: boolean): Promise<DetectResult | null> {
  const res = await apiFetch(`/api/document-automation/templates/${id}/detect`, {
    method: 'POST',
    body: JSON.stringify({ useAi }),
  });
  if (!res.ok) return null;
  return await parseJson<DetectResult>(res);
}

export type PreviewResult =
  | { ok: true; html?: string; pdfBase64?: string; mergeWarning?: string }
  | { ok: false; error: string };

export async function previewDocument(id: string, values: Record<string, string>): Promise<PreviewResult> {
  const res = await apiFetch(`/api/document-automation/templates/${id}/preview`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  });
  const text = await res.text();
  let data: { html?: string; pdfBase64?: string; mergeWarning?: string; error?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: 'Invalid server response' };
  }
  if (!res.ok) {
    return { ok: false, error: String(data.error || `Request failed (${res.status})`) };
  }
  return {
    ok: true,
    html: typeof data.html === 'string' ? data.html : undefined,
    pdfBase64: typeof data.pdfBase64 === 'string' ? data.pdfBase64 : undefined,
    mergeWarning: typeof data.mergeWarning === 'string' ? data.mergeWarning : undefined,
  };
}

export type GenerateSuccess = {
  run: DocumentAutomationRunRow;
  downloadDocxUrl?: string | null;
  downloadPdfUrl: string | null;
  pdfError?: string;
  mergeWarning?: string;
};

export type GenerateResult = GenerateSuccess | { error: string };

export async function generateDocument(
  id: string,
  body: { values: Record<string, string>; employeeId?: string; outputPdf?: boolean }
): Promise<GenerateResult> {
  const res = await apiFetch(`/api/document-automation/templates/${id}/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { error: 'Invalid server response' };
  }
  if (!res.ok) {
    return { error: String(data.error || `Request failed (${res.status})`) };
  }
  return data as GenerateSuccess;
}

export type BatchGenerateSuccess = {
  ok: true;
  generated: number;
  results: Array<{ index: number } & GenerateSuccess>;
  errors: Array<{ index: number; error: string }>;
};

export type BatchGenerateResult = BatchGenerateSuccess | { error: string };

export async function generateDocumentBatch(
  id: string,
  body: { rows: Record<string, string>[]; employeeId?: string; outputPdf?: boolean }
): Promise<BatchGenerateResult> {
  const res = await apiFetch(`/api/document-automation/templates/${id}/generate-batch`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { error: 'Invalid server response' };
  }
  if (!res.ok) {
    return { error: String(data.error || `Request failed (${res.status})`) };
  }
  return data as BatchGenerateSuccess;
}

export async function fetchDocumentRuns(): Promise<DocumentAutomationRunRow[]> {
  const res = await apiFetch('/api/document-automation/runs');
  if (!res.ok) return [];
  return await parseJson<DocumentAutomationRunRow[]>(res);
}

export async function fetchEmployeeDocDefaults(employeeId: string): Promise<Record<string, string>> {
  const res = await apiFetch(`/api/document-automation/employee-defaults/${encodeURIComponent(employeeId)}`);
  if (!res.ok) return {};
  const data = await parseJson<{ values: Record<string, string> }>(res);
  return data.values || {};
}

export function runDownloadUrl(pathFromApi: string): string {
  const base = getApiBaseUrl();
  return `${base}${pathFromApi.startsWith('/') ? pathFromApi : `/${pathFromApi}`}`;
}

export async function downloadAutomationFile(apiPath: string, suggestedName: string): Promise<boolean> {
  const res = await apiFetch(apiPath.startsWith('/') ? apiPath : `/${apiPath}`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
