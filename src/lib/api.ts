const configuredBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

/** Public API origin. Leave empty when the API is served by the same origin. */
export const API_BASE_URL = configuredBase;
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

/**
 * Fetch a JSON API response and turn HTML/text fallbacks into an actionable error.
 * This avoids leaking "Unexpected token '<'" when a static host has no /api route.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const endpoint = apiUrl(input);
  let response: Response;
  try {
    response = await fetch(endpoint, init);
  } catch (error: any) {
    throw new ApiError(
      `Backend unavailable at ${API_BASE_URL || 'this site'}: ${error?.message || 'network request failed'}`,
      0,
      endpoint
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('json')) {
    const body = await response.text().catch(() => '');
    let detail = '';
    if (contentType.toLowerCase().includes('json')) {
      try {
        const parsed = JSON.parse(body);
        detail = parsed.message || parsed.error || '';
      } catch {
        detail = '';
      }
    }
    if (!detail && body) detail = body.replace(/\s+/g, ' ').slice(0, 180);
    const hostHint = API_BASE_URL
      ? `Check that the backend is running at ${API_BASE_URL}.`
      : 'Set VITE_API_BASE_URL to the public URL of the VitaSync Node backend.';
    throw new ApiError(
      `VitaSync API request failed (${response.status || 'no status'}) for ${input}. ${detail || hostHint}`,
      response.status,
      endpoint
    );
  }
  return response;
}

export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path));
}
