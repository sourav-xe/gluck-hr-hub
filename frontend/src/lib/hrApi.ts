import { apiFetch, getApiBaseUrl, loadStoredAuth } from '@/lib/api';
import type {
  AttendanceRecord,
  AttendanceSettings,
  Automation,
  GeneratedDocument,
  LeaveBalance,
  LeaveRequest,
  PayrollRecord,
  RegularizationRequest,
} from '@/types/hr';

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function fetchAttendanceRecords(): Promise<AttendanceRecord[]> {
  const res = await apiFetch('/api/attendance-records');
  if (!res.ok) return [];
  return await parseJson<AttendanceRecord[]>(res);
}

export async function postAttendanceBulk(records: AttendanceRecord[]): Promise<boolean> {
  const res = await apiFetch('/api/attendance-records/bulk', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
  return res.ok;
}

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const res = await apiFetch('/api/leave-requests');
  if (!res.ok) return [];
  return await parseJson<LeaveRequest[]>(res);
}

export async function postLeaveRequest(body: Partial<LeaveRequest>): Promise<LeaveRequest | null> {
  const res = await apiFetch('/api/leave-requests', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<LeaveRequest>(res);
}

export async function patchLeaveRequest(id: string, body: Partial<LeaveRequest>): Promise<LeaveRequest | null> {
  const res = await apiFetch(`/api/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<LeaveRequest>(res);
}

export async function fetchRegularizationRequests(): Promise<RegularizationRequest[]> {
  const res = await apiFetch('/api/regularization-requests');
  if (!res.ok) return [];
  return await parseJson<RegularizationRequest[]>(res);
}

export async function postRegularizationRequest(body: Partial<RegularizationRequest>): Promise<RegularizationRequest | null> {
  const res = await apiFetch('/api/regularization-requests', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<RegularizationRequest>(res);
}

export async function patchRegularizationRequest(id: string, body: Partial<RegularizationRequest>): Promise<RegularizationRequest | null> {
  const res = await apiFetch(`/api/regularization-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<RegularizationRequest>(res);
}

export async function fetchLeaveBalances(): Promise<LeaveBalance[]> {
  const res = await apiFetch('/api/leave-balances');
  if (!res.ok) return [];
  return await parseJson<LeaveBalance[]>(res);
}

export async function fetchPayrollRecords(month?: string, year?: number): Promise<PayrollRecord[]> {
  const q = new URLSearchParams();
  if (month) q.set('month', month);
  if (year !== undefined) q.set('year', String(year));
  const res = await apiFetch(`/api/payroll-records?${q}`);
  if (!res.ok) return [];
  return await parseJson<PayrollRecord[]>(res);
}

export async function fetchPayrollRecordById(id: string): Promise<PayrollRecord | null> {
  const res = await apiFetch(`/api/payroll-records/${id}`);
  if (!res.ok) return null;
  return await parseJson<PayrollRecord>(res);
}

export async function postPayrollBulkUpsert(records: PayrollRecord[]): Promise<PayrollRecord[]> {
  const res = await apiFetch('/api/payroll-records/bulk-upsert', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
  if (!res.ok) return [];
  return await parseJson<PayrollRecord[]>(res);
}

export async function patchPayrollRecord(id: string, body: Partial<PayrollRecord>): Promise<PayrollRecord | null> {
  const res = await apiFetch(`/api/payroll-records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<PayrollRecord>(res);
}

export async function markAllPayrollPaidForMonth(month: string, year: number): Promise<boolean> {
  const res = await apiFetch('/api/payroll-records', {
    method: 'PATCH',
    body: JSON.stringify({ month, year, status: 'Paid' }),
  });
  return res.ok;
}

export async function fetchGeneratedDocuments(): Promise<GeneratedDocument[]> {
  const res = await apiFetch('/api/generated-documents');
  if (!res.ok) return [];
  return await parseJson<GeneratedDocument[]>(res);
}

export async function postGeneratedDocument(body: Partial<GeneratedDocument>): Promise<GeneratedDocument | null> {
  const res = await apiFetch('/api/generated-documents', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<GeneratedDocument>(res);
}

export async function deleteGeneratedDocument(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/generated-documents/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function fetchAutomations(): Promise<Automation[]> {
  const res = await apiFetch('/api/automations');
  if (!res.ok) return [];
  return await parseJson<Automation[]>(res);
}

export async function patchAutomation(id: string, body: Partial<Automation>): Promise<Automation | null> {
  const res = await apiFetch(`/api/automations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return await parseJson<Automation>(res);
}

export async function fetchAttendanceSettings(): Promise<AttendanceSettings> {
  const res = await apiFetch('/api/settings/attendance');
  if (!res.ok) throw new Error('Failed to load settings');
  return await parseJson<AttendanceSettings>(res);
}

export async function putAttendanceSettings(body: Partial<AttendanceSettings>): Promise<AttendanceSettings> {
  const res = await apiFetch('/api/settings/attendance', { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Failed to save settings');
  return await parseJson<AttendanceSettings>(res);
}

export async function postGoogleChatMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch('/api/integrations/gchat/send', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (res.ok) return { ok: true };
  let error = 'Failed to send message';
  try {
    const data = await parseJson<{ error?: string }>(res);
    if (data?.error) error = data.error;
  } catch {
    // ignore parse errors
  }
  return { ok: false, error };
}

export interface AnnouncementSettingsDto {
  birthdayTemplates?: string[];
  festivalTemplates?: string[];
  birthdayTemplate: string;
  festivalTemplate: string;
  festivalName: string;
  festivalMonthDay: string;
  autoBirthdayEnabled: boolean;
  autoFestivalEnabled: boolean;
  lastBirthdayRunOn?: string;
  lastFestivalRunOn?: string;
  lastBirthdayTemplateIndex?: number;
  lastFestivalTemplateIndex?: number;
}

export async function fetchAnnouncementSettings(): Promise<AnnouncementSettingsDto> {
  const res = await apiFetch('/api/settings/announcements');
  if (!res.ok) throw new Error('Failed to load announcement settings');
  return await parseJson<AnnouncementSettingsDto>(res);
}

export async function putAnnouncementSettings(body: Partial<AnnouncementSettingsDto>): Promise<AnnouncementSettingsDto> {
  const res = await apiFetch('/api/settings/announcements', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save announcement settings');
  return await parseJson<AnnouncementSettingsDto>(res);
}

// ─── Festival Calendar ────────────────────────────────────────────────────────

export interface FestivalRow {
  id: string;
  name: string;
  monthDay: string; // MM-DD
  emoji: string;
  templateMessage: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export async function fetchFestivals(): Promise<FestivalRow[]> {
  const res = await apiFetch('/api/festivals');
  if (!res.ok) return [];
  return parseJson<FestivalRow[]>(res);
}

export async function createFestival(body: Partial<FestivalRow>): Promise<FestivalRow | null> {
  const res = await apiFetch('/api/festivals', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return parseJson<FestivalRow>(res);
}

export async function updateFestival(id: string, body: Partial<FestivalRow>): Promise<FestivalRow | null> {
  const res = await apiFetch(`/api/festivals/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return parseJson<FestivalRow>(res);
}

export async function deleteFestival(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/festivals/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function bulkEnableFestivals(ids: string[] | 'all', enabled: boolean): Promise<FestivalRow[]> {
  const res = await apiFetch('/api/festivals/bulk-enable', { method: 'POST', body: JSON.stringify({ ids, enabled }) });
  if (!res.ok) return [];
  return parseJson<FestivalRow[]>(res);
}

export async function parseFestivalsFromText(text: string): Promise<{ festivals: { name: string; monthDay: string; emoji: string }[]; source: string }> {
  const res = await apiFetch('/api/festivals/parse-from-text', { method: 'POST', body: JSON.stringify({ text }) });
  if (!res.ok) return { festivals: [], source: 'error' };
  return parseJson(res);
}

export async function suggestFestivalTemplate(id: string): Promise<{ message: string; source: string }> {
  const res = await apiFetch(`/api/festivals/${id}/suggest-template`, { method: 'POST' });
  if (!res.ok) return { message: '', source: 'error' };
  return parseJson(res);
}

// ── Email Templates ────────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: string;
  isDefault: boolean;
  createdAt?: string;
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await apiFetch('/api/email-templates');
  if (!res.ok) return [];
  return parseJson<EmailTemplate[]>(res);
}

export async function createEmailTemplate(body: Omit<EmailTemplate, 'id' | 'isDefault' | 'variables' | 'createdAt'>): Promise<EmailTemplate | null> {
  const res = await apiFetch('/api/email-templates', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return null;
  return parseJson<EmailTemplate>(res);
}

export async function updateEmailTemplate(
  id: string,
  body: Partial<Pick<EmailTemplate, 'name' | 'subject' | 'body' | 'category'>>
): Promise<{ ok: true; template: EmailTemplate } | { ok: false; error: string; status: number }> {
  const res = await apiFetch(`/api/email-templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) {
    let error = `Update failed (${res.status})`;
    try {
      const data = await parseJson<{ error?: string }>(res);
      if (data?.error) error = data.error;
    } catch {
      // noop
    }
    return { ok: false, error, status: res.status };
  }
  const template = await parseJson<EmailTemplate>(res);
  return { ok: true, template };
}

export async function deleteEmailTemplate(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/email-templates/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function sendEmail(params: {
  to: string;
  templateId: string;
  variables: Record<string, string>;
  attachments?: File[];
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const form = new FormData();
  form.append('to', params.to);
  form.append('templateId', params.templateId);
  form.append('variables', JSON.stringify(params.variables));
  if (params.attachments) {
    for (const file of params.attachments) {
      form.append('attachments', file);
    }
  }
  const res = await apiFetch('/api/email/send', { method: 'POST', body: form });
  if (!res.ok) {
    try {
      const d = await parseJson<{ error?: string }>(res);
      return { ok: false, error: d?.error ?? 'Send failed' };
    } catch {
      return { ok: false, error: 'Send failed' };
    }
  }
  return parseJson<{ ok: boolean; message?: string }>(res);
}

export async function fetchEmailConfigStatus(): Promise<{ configured: boolean; emailFrom: string | null }> {
  const res = await apiFetch('/api/email/config-status');
  if (!res.ok) return { configured: false, emailFrom: null };
  return parseJson(res);
}

export async function verifyEmailConnection(): Promise<{ ok: boolean; message?: string; error?: string; hint?: string }> {
  const res = await apiFetch('/api/email/verify', { method: 'POST' });
  if (!res.ok) return { ok: false, error: 'Server error' };
  return parseJson(res);
}

/**
 * Merge Auto-Docs template on the server (DOCX or PDF). Keeps the browser thread free.
 * `onProgress`: rough 0–100 from upload + response download (when length known).
 */
export async function generateSimpleTemplateDocument(
  templateId: string,
  fieldValues: Record<string, string>,
  format: 'docx' | 'pdf',
  onProgress?: (percent: number) => void
): Promise<Blob | { error: string }> {
  let lastReported = 0;
  let creepTimer: ReturnType<typeof setInterval> | null = null;

  const report = (n: number) => {
    lastReported = Math.max(lastReported, Math.max(0, Math.min(100, Math.round(n))));
    onProgress?.(lastReported);
  };

  const stopCreep = () => {
    if (creepTimer !== null) {
      clearInterval(creepTimer);
      creepTimer = null;
    }
  };

  /** While the server merges + converts (especially PDF), no response bytes arrive — advance slowly so the bar is not stuck at ~4%. */
  const startCreep = () => {
    if (creepTimer !== null) return;
    creepTimer = setInterval(() => {
      if (lastReported < 92) report(lastReported + 1);
    }, 1100);
  };

  return new Promise((resolve) => {
    const auth = loadStoredAuth();
    const xhr = new XMLHttpRequest();
    const url = `${getApiBaseUrl()}/api/doc-simple-templates/${encodeURIComponent(templateId)}/generate`;
    const body = JSON.stringify({ fieldValues, format });

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (auth?.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        report(4 * (e.loaded / e.total));
      }
    };

    xhr.upload.onload = () => {
      report(Math.max(lastReported, 5));
      startCreep();
    };

    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        stopCreep();
        report(5 + 95 * (e.loaded / e.total));
      }
    };

    xhr.onload = () => {
      stopCreep();
      if (xhr.status >= 200 && xhr.status < 300) {
        report(100);
        resolve(xhr.response as Blob);
        return;
      }

      void (async () => {
        let msg = `Generation failed (${xhr.status})`;
        try {
          const blob = xhr.response as Blob;
          if (blob && typeof blob.text === 'function') {
            const t = await blob.text();
            const d = JSON.parse(t) as { error?: string };
            if (d?.error) msg = d.error;
          }
        } catch {
          // noop
        }
        resolve({ error: msg });
      })();
    };

    xhr.onerror = () => {
      stopCreep();
      resolve({ error: 'API unreachable' });
    };
    xhr.responseType = 'blob';
    report(1);
    xhr.send(body);

    // Tiny JSON body may skip upload progress; still show server-working phase (avoid restarting after DONE).
    setTimeout(() => {
      if (xhr.readyState === XMLHttpRequest.DONE) return;
      report(Math.max(lastReported, 5));
      startCreep();
    }, 120);
  });
}

/**
 * Convert merged DOCX → PDF via API. Optional `onProgress` reports 0–100 for upload + response download.
 */
export async function convertDocxBlobToPdf(
  docxBlob: Blob,
  onProgress?: (percent: number) => void
): Promise<Blob | { error: string }> {
  const report = (n: number) => onProgress?.(Math.max(0, Math.min(100, Math.round(n))));

  return new Promise((resolve) => {
    const auth = loadStoredAuth();
    const form = new FormData();
    form.append('file', docxBlob, 'document.docx');
    const xhr = new XMLHttpRequest();
    const url = `${getApiBaseUrl()}/api/convert-docx-to-pdf`;
    let uploadFinished = false;

    xhr.open('POST', url);
    if (auth?.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        report((e.loaded / e.total) * 40);
      }
    };
    xhr.upload.onload = () => {
      uploadFinished = true;
      report(42);
    };

    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        report(42 + (e.loaded / e.total) * 56);
      }
    };

    xhr.onload = () => {
      const finishErr = async () => {
        let msg = `PDF conversion failed (${xhr.status})`;
        try {
          const blob = xhr.response as Blob;
          if (blob && typeof (blob as Blob).text === 'function') {
            const t = await (blob as Blob).text();
            const d = JSON.parse(t) as { error?: string };
            if (d?.error) msg = d.error;
          }
        } catch {
          // noop
        }
        resolve({ error: msg });
      };

      if (xhr.status >= 200 && xhr.status < 300) {
        report(100);
        const blob = xhr.response as Blob;
        resolve(blob);
        return;
      }
      void finishErr();
    };

    xhr.onerror = () => resolve({ error: 'API unreachable' });
    xhr.responseType = 'blob';

    report(1);
    xhr.send(form);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function triggerAnnouncement(body: { mode: 'manual' | 'birthday' | 'festival'; message?: string; name?: string; festivalName?: string; templateIndex?: number }): Promise<{ ok: boolean; sentCount?: number; usedTemplateIndex?: number; error?: string }> {
  const res = await apiFetch('/api/announcements/trigger', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let error = 'Failed to trigger announcement';
    try {
      const data = await parseJson<{ error?: string }>(res);
      if (data?.error) error = data.error;
    } catch {
      // noop
    }
    return { ok: false, error };
  }
  return await parseJson<{ ok: boolean; sentCount?: number; usedTemplateIndex?: number }>(res);
}
