export async function providerRequest<T>(url: string, apiKey: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body as T;
}
