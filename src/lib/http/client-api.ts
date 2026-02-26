export interface ApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface ApiRequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
  redirectOnUnauthorized?: boolean;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function isAuthEndpoint(url: string): boolean {
  return url.startsWith('/api/v1/auth/');
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  return response.ok;
}

export async function apiRequest<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  const requestOptions: RequestInit = {
    credentials: 'include',
    ...options,
  };

  let response = await fetch(url, requestOptions);
  const canRetryAuth = !options?.skipAuthRefresh && !isAuthEndpoint(url);

  if (response.status === 401 && canRetryAuth) {
    const refreshed = await tryRefreshAccessToken().catch(() => false);
    if (refreshed) {
      response = await fetch(url, requestOptions);
    }
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? ((payload as ApiErrorPayload).error?.message ?? `Request failed with status ${response.status}`)
        : `Request failed with status ${response.status}`;
    const code =
      typeof payload === 'object' && payload && 'error' in payload
        ? (payload as ApiErrorPayload).error?.code
        : undefined;

    if (response.status === 401 && options?.redirectOnUnauthorized !== false && typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new ApiRequestError(message, response.status, code);
  }

  return payload as T;
}
