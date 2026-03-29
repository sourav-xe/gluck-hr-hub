const STORAGE_KEY = 'hrms_auth';

/**
 * In Vite dev, use same-origin `/api` (proxied to Express). In production, set VITE_API_URL.
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return (url || '').replace(/\/$/, '');
}

export type StoredAuth = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    employeeId?: string;
    employeeCode?: string;
    onboardingComplete?: boolean | null;
    needsOnboarding?: boolean;
    /** Present when Super Admin set a custom sidebar allow-list on the linked employee. */
    sidebarNavAllow?: string[];
  };
};

export function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredAuth;
    if (!data?.token || !data?.user?.email) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveStoredAuth(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = loadStoredAuth();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (auth?.token) {
    headers.set('Authorization', `Bearer ${auth.token}`);
  }
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    return await fetch(url, {
      ...init,
      headers,
    });
  } catch (e) {
    // Prevent React from going blank when the backend is down/unreachable.
    return new Response(JSON.stringify({ error: 'API unreachable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
