/**
 * Hardcoded in-memory template store.
 * Replace this with your real DB calls (MongoDB / Supabase) later.
 */

export interface TemplateField {
  fieldName: string;
  placeholder: string;
  xmlPath?: string;
}

export interface MockTemplate {
  id: string;
  name: string;
  description: string | null;
  original_file_name: string;
  original_file_url: string; // base64 data URL of uploaded DOCX
  file_type: string;
  fields: TemplateField[];
  created_at: string;
}

// In-memory store (persists across page navigations but resets on full reload)
let templates: MockTemplate[] = [];

export function getAllTemplates(): MockTemplate[] {
  return [...templates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getTemplateById(id: string): MockTemplate | null {
  return templates.find((t) => t.id === id) || null;
}

export function addTemplate(t: Omit<MockTemplate, 'id' | 'created_at'>): MockTemplate {
  const newTemplate: MockTemplate = {
    ...t,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  templates.push(newTemplate);
  // Also persist to localStorage so data survives refresh
  _persist();
  return newTemplate;
}

export function deleteTemplate(id: string): boolean {
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  templates.splice(idx, 1);
  _persist();
  return true;
}

// LocalStorage persistence helpers
const LS_KEY = 'mock_document_templates';

function _persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(templates));
  } catch { /* quota exceeded – ignore */ }
}

function _hydrate() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) templates = JSON.parse(raw);
  } catch { /* corrupt – ignore */ }
}

// Hydrate on import
_hydrate();
