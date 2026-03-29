/** Labels & input hints for SimpleDocTemplate fields (saved `label` from server, or inferred for legacy templates). */

export type SimpleTemplateFieldRow = { label?: string; fieldName: string; placeholder: string };

function normalizeToken(raw: string): string {
  return String(raw || '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Mirror server `inferSnippetLabel` for templates uploaded before `label` was stored. */
export function inferLabelFromPlaceholderSnippet(snippet: string): string | null {
  const t = String(snippet || '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();

  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) return 'Date';
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) && /\d{4}/.test(t)) {
    return 'Date';
  }
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lower) && /\d/.test(t)) return 'Date';

  if (/\b(lkr|rs\.?|usd|\$|eur|£|pkr|inr)\b/i.test(t)) return 'Amount';
  if (/^\d[\d,\s]*$/.test(t.replace(/\s/g, '')) || /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return 'Amount';
  if (/\d{1,3}(,\d{3})+/.test(t)) return 'Amount';
  if (/\b(language\s+enrol|enrollment|target|incentive|bonus|commission)\b/i.test(t)) return 'Target / incentive';

  if (/\b(onsite|remote|hybrid|work from home|wfh)\b/i.test(t)) return 'Work arrangement';
  if (/\b(kandy|colombo|office)\b/i.test(lower) && t.length < 80) return 'Work location';

  if (
    /\b(associate|manager|director|executive|intern|specialist|analyst|engineer|developer|consultant)\b/i.test(lower)
    || /\b(sales|junior|senior|lead|officer|coordinator|admin|representative)\b/i.test(lower)
  ) {
    return 'Role';
  }

  if (
    /\b(sri lanka|india|usa|uae|uk|canada|australia|singapore|pakistan|bangladesh|nepal)\b/i.test(lower)
    || (/\b(province|district|city|state|country)\b/i.test(lower) && t.length < 60)
  ) {
    return 'Location';
  }

  if (!/\d/.test(t) && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(t) && t.length <= 80) return 'Candidate name';
  if (!/\d/.test(t) && /^[A-Z][a-z]+\s+[A-Za-z][a-z]+$/.test(t) && t.length <= 50) return 'Candidate name';

  return null;
}

function labelFromFieldKey(fieldName: string): string | null {
  const key = normalizeToken(fieldName).toLowerCase();
  if (!key) return null;
  if (/\bdate\b|\bdob\b|\bdoj\b|join|effective|start/.test(key)) return 'Date';
  if (/\bname\b|candidate|employee|applicant/.test(key)) return 'Candidate name';
  if (/\brole\b|title|position|designation|job/.test(key)) return 'Role';
  if (/\bsalary\b|amount|pay|compensation|wage/.test(key)) return 'Amount';
  if (/\blocation\b|country|region|city|address/.test(key)) return 'Location';
  return null;
}

export function formLabelForSimpleField(field: SimpleTemplateFieldRow): string {
  const saved = field.label?.trim();
  if (saved) return saved;

  const inferred = inferLabelFromPlaceholderSnippet(field.placeholder);
  if (inferred) return inferred;

  const fromKey = labelFromFieldKey(field.fieldName);
  if (fromKey) return fromKey;

  const source = normalizeToken(field.fieldName || field.placeholder || '');
  if (!source) return 'Field';

  const lower = source.toLowerCase();
  if (/\b(date|dob|doj|joining)\b/.test(lower)) return 'Date';
  if (/\b(candidate|employee|emp|name)\b/.test(lower)) return 'Candidate name';
  if (/\b(role|position|designation|title)\b/.test(lower)) return 'Role';
  if (/\b(company|organization|org)\b/.test(lower)) return 'Company name';
  if (/\b(email|mail)\b/.test(lower)) return 'Email';
  if (/\b(phone|mobile|contact)\b/.test(lower)) return 'Phone number';
  if (/\b(salary|amount|pay)\b/.test(lower)) return 'Amount';
  if (/\b(location|city|state|country|address)\b/.test(lower)) return 'Location';

  return toTitleCase(source);
}

export function inputPlaceholderForFormLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('date')) return 'Enter date';
  if (lower.includes('name') || lower.includes('candidate')) return 'Enter candidate name';
  if (lower.includes('role') || lower.includes('job title') || lower.includes('designation') || lower.includes('title')) {
    return 'Enter role';
  }
  if (lower.includes('company')) return 'Enter company name';
  if (lower.includes('email')) return 'Enter email address';
  if (lower.includes('phone')) return 'Enter phone number';
  if (lower.includes('amount') || lower.includes('salary') || lower.includes('pay') || lower.includes('compensation')) {
    return 'Enter amount';
  }
  if (lower.includes('location') || lower.includes('country') || lower.includes('region') || lower.includes('work location')) {
    return 'Enter location';
  }
  if (lower.includes('arrangement') || lower.includes('remote') || lower.includes('onsite') || lower.includes('hybrid')) {
    return 'Enter work arrangement';
  }
  if (lower.includes('target') || lower.includes('incentive') || lower.includes('kpi')) return 'Enter target or details';
  return `Enter ${label.toLowerCase()}`;
}
