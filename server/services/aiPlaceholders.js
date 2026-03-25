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
 * Heuristic suggestions when OpenAI is unavailable.
 * @param {string[]} snippets
 * @returns {{ key: string, label: string, exampleValue: string, source: 'heuristic' }[]}
 */
export function heuristicSuggestions(snippets) {
  return (snippets || []).map((raw, i) => {
    const exampleValue = String(raw).trim();
    return {
      key: slugKey(exampleValue, i),
      label: titleCaseLabel(exampleValue.slice(0, 80)),
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
          'You help HR software map short text snippets from offer letters to machine keys. Return JSON: {"items":[{"snippet":"exact","key":"snake_case","label":"Human label"}]}. Keys: lowercase snake_case, unique, max 40 chars. Do not invent data; only map given snippets.',
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
      out.push({
        key: attempt,
        label: String(row.label || '').trim() || titleCaseLabel(snippet.slice(0, 80)),
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
