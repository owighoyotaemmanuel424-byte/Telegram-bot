const deploymentUrl = process.env.CONVEX_URL;

if (!deploymentUrl) console.warn('CONVEX_URL is not configured; Convex persistence is disabled until deployment configuration is supplied.');

export async function convexFunction<T>(path: string, args: Record<string, unknown>): Promise<T> {
  if (!deploymentUrl) throw new Error('CONVEX_URL is not configured');
  const response = await fetch(`${deploymentUrl}/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args })
  });
  if (!response.ok) throw new Error(`Convex request failed: ${response.status}`);
  return await response.json() as T;
}
