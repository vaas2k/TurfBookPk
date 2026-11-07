export type Profile = { id: string; full_name: string; role: 'player' | 'vendor' | 'admin' };

function errorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string') return error.message;
  }
  return 'Something went wrong. Please try again.';
}

async function call(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {
    ...options, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload));
  return payload;
}

export async function request(path: string, options: RequestInit = {}): Promise<unknown> { return call(`/api/admin-proxy${path}`, options); }

export async function uploadFinancialProof(file: File): Promise<string> {
  const result = await request('/financial-proof-upload', { method: 'POST', body: JSON.stringify({ content_type: file.type || 'application/pdf', content_length: file.size }) }) as { target: { key: string; upload_url: string; fields: Record<string, string> } };
  const form = new FormData();
  Object.entries(result.target.fields).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);
  const uploaded = await fetch(result.target.upload_url, { method: 'POST', body: form });
  if (!uploaded.ok) throw new Error('Receipt upload failed. Please try again.');
  return result.target.key;
}

export async function requestOtp(phone: string) { await call('/api/session/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }); }

export async function verifyOtp(phone: string, code: string): Promise<{ profile: Profile }> {
  return call('/api/session/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }) as Promise<{ profile: Profile }>;
}

export async function signOut() { await call('/api/session/logout', { method: 'POST' }); }
