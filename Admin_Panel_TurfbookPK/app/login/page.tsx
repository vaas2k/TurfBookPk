'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtp, verifyOtp } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState(''); const [code, setCode] = useState('');
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      if (!sent) { await requestOtp(phone); setSent(true); return; }
      await verifyOtp(phone, code);
      router.replace('/dashboard');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sign in.'); }
    finally { setLoading(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="brand"><span /> TurfBookPK <b>Admin</b></div><p className="eyebrow">OPERATIONS CONSOLE</p><h1>Sign in to manage the marketplace.</h1><p className="muted">Use your approved administrator phone number. A one-time verification code will be sent to you.</p><form onSubmit={submit}><label>Phone number<input autoComplete="tel" inputMode="tel" placeholder="923001234567" value={phone} disabled={sent || loading} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} required /></label>{sent && <label>Verification code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required /></label>}{error && <p className="form-error">{error}</p>}<button className="primary" disabled={loading}>{loading ? 'Please wait…' : sent ? 'Verify and continue' : 'Send verification code'}</button>{sent && <button className="link-button" type="button" onClick={() => { setSent(false); setCode(''); setError(''); }}>Use another number</button>}</form></section></main>;
}
