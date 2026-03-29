/**
 * AI-assisted placeholder naming. Always returns suggestions for manual review — never auto-writes templates.
 */

function slugKey(text, index) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `field_${index + 1}`;
}

function titleCaseLabel(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Classify red snippet text into a short label for forms (not the literal sample value).
 * @param {string} snippet
 */
export function inferSnippetLabel(snippet) {
  const t = String(snippet || '').trim();
  if (!t) return 'Field';
  const lower = t.toLowerCase();

  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(t)) return 'Date';
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) && /\d{4}/.test(t)) {
    return 'Date';
  }
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lower) && /\d/.test(t)) return 'Date';

  if (/\b(lkr|rs\.?|usd|\$|eur|£|pkr|inr)\b/i.test(t)) return 'Amount';
  if (/^\d[\d,\s]*$/.test(t.replace(/\s/g, '')) || /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return 'Amount';
  if (/\d{1,3}(,\d{3})+/.test(t)) return 'Amount';
  if (/\b(language\s+enrol|enrollment|target|incentive|bonus|commission)\b/i.test(t)) return 'Target / incentive';

  if (/\b(ONSITE|onsite|remote|hybrid|work from home|wfh)\b/i.test(t)) return 'Work arrangement';
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

  return titleCaseLabel(t.slice(0, 72)) || 'Field';
}

/**
 * Heuristic suggestions when OpenAI is unavailable.
 * @param {string[]} snippets
 * @returns {{ key: string, label: string, exampleValue: string, source: 'heuristic' }[]}
 */
export function heuristicSuggestions(snippets) {
  return (snippets || []).map((raw, i) => {
    const exampleValue = String(raw).trim();
    return {
      key: slugKey(exampleValue, i),
      label: inferSnippetLabel(exampleValue),
      exampleValue,
      source: 'heuristic',
    };
  });
}

/**
 * Optional OpenAI enrichment. Requires OPENAI_API_KEY.
 * @param {string[]} snippets
 * @returns {Promise<{ key: string, label: string, exampleValue: string, source: 'ai' | 'heuristic' }[]>}
 */
export async function suggestPlaceholdersWithAi(snippets) {
  const list = (snippets || []).map((s) => String(s).trim()).filter(Boolean);
  if (list.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicSuggestions(list).map((h) => ({ ...h, source: 'heuristic' }));
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You help HR software map RED placeholder snippets from Word documents. Return JSON: {"items":[{"snippet":"exact text from input","key":"snake_case","label":"short field type"}]}. Rules: (1) snippet must match the input exactly. (2) key: lowercase snake_case, unique, max 40 chars, describe the field (e.g. letter_date, candidate_name, role_title). (3) label: what the user fills in — NEVER copy the sample value; use short types like "Letter date", "Candidate name", "Role or job title", "Country or region", "Base salary", "Work location", "Target or KPI". One item per snippet, same order as input.',
      },
      { role: 'user', content: JSON.stringify({ snippets: list }) },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[aiPlaceholders] OpenAI error', res.status, errText);
    return heuristicSuggestions(list).map((h) => ({ ...h, source: 'heuristic' }));
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) {
    return heuristicSuggestions(list).map((h) => ({ ...h, source: 'heuristic' }));
  }

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const out = [];
    const usedKeys = new Set();
    for (let i = 0; i < list.length; i += 1) {
      const snippet = list[i];
      const row = items.find((it) => String(it.snippet || '').trim() === snippet) || items[i] || {};
      let key = String(row.key || '').trim() || slugKey(snippet, i);
      key = key.replace(/[^a-z0-9_]/gi, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || slugKey(snippet, i);
      let attempt = key;
      let n = 0;
      while (usedKeys.has(attempt)) {
        n += 1;
        attempt = `${key}_${n}`;
      }
      usedKeys.add(attempt);
      const aiLabel = String(row.label || '').trim();
      out.push({
        key: attempt,
        label: aiLabel || inferSnippetLabel(snippet),
        exampleValue: snippet,
        source: 'ai',
      });
    }
    return out;
  } catch (e) {
    console.warn('[aiPlaceholders] parse failed', e?.message || e);
    return heuristicSuggestions(list).map((h) => ({ ...h, source: 'heuristic' }));
  }
}
