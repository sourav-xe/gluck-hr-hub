import { apiFetch } from '@/lib/api';
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
