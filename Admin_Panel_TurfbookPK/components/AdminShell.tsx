'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { signOut } from '../lib/api';

export function useAdminSession(): boolean {
  const router = useRouter(); const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, [router]);
  return ready;
}

export function AdminShell({ children, active }: { children: ReactNode; active: 'dashboard' | 'grounds' | 'ground_verification' | 'users' | 'reviews' | 'transactions' | 'operations' | 'refunds' | 'vendor_verification' | 'vendors' }) {
  const router = useRouter();
  async function leave() { await signOut().catch(() => undefined); router.replace('/login'); }
  return <main className="admin-shell"><aside><div className="brand"><span /> TurfBookPK <b>Admin</b></div><nav><Link className={active === 'dashboard' ? 'active' : ''} href="/dashboard">Dashboard</Link><Link className={active === 'vendor_verification' ? 'active' : ''} href="/dashboard/vendor-verification">Vendor verification</Link><Link className={active === 'ground_verification' ? 'active' : ''} href="/dashboard/ground-verification">Ground verification</Link><Link className={active === 'vendors' ? 'active' : ''} href="/dashboard/vendors">Vendors</Link><Link className={active === 'grounds' ? 'active' : ''} href="/dashboard/grounds">Ground Listings</Link><Link className={active === 'users' ? 'active' : ''} href="/dashboard/users">Users &amp; Owners</Link><Link className={active === 'transactions' ? 'active' : ''} href="/dashboard/transactions">Transactions</Link><Link className={active === 'refunds' ? 'active' : ''} href="/dashboard/refunds">Refunds</Link><Link className={active === 'operations' ? 'active' : ''} href="/dashboard/operations">Reports &amp; Analytics</Link><Link className={active === 'reviews' ? 'active' : ''} href="/dashboard#reports">Reviews Moderation</Link></nav><button className="signout" onClick={() => void leave()}>Sign out</button></aside><section className="content">{children}</section></main>;
}
