const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.error === 'string') message = data.error;
      else if (data.error) message = 'Invalid request. Check the form fields.';
    } catch { /* non-JSON error body */ }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export const apiUrl = (path: string) => BASE + path;
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
