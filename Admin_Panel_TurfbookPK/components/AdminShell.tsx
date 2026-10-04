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

export function AdminShell({ children, active }: { children: ReactNode; active: 'dashboard' | 'grounds' | 'ground_verification' | 'users' | 'reviews' | 'transactions' | 'operations' | 'refunds' | 'payouts' | 'commission' | 'vendor_verification' | 'vendors' | 'audit_logs' }) {
  const router = useRouter();
  async function leave() { await signOut().catch(() => undefined); router.replace('/login'); }
  const nav = [{ href: '/dashboard', key: 'dashboard', icon: '◔', label: 'Dashboard' }, { href: '/dashboard/vendors', key: 'vendors', icon: '◉', label: 'Vendors & grounds' }, { href: '/dashboard/users', key: 'users', icon: '♙', label: 'Users & Owners' }, { href: '/dashboard/transactions', key: 'transactions', icon: '▣', label: 'Transactions' }, { href: '/dashboard/refunds', key: 'refunds', icon: '↙', label: 'Refunds & Disputes' }, { href: '/dashboard/vendor-verification', key: 'vendor_verification', icon: '✓', label: 'Vendor verification' }, { href: '/dashboard/ground-verification', key: 'ground_verification', icon: '⌂', label: 'Ground verification' }, { href: '/dashboard/reviews', key: 'reviews', icon: '✕', label: 'Reviews Moderation' }, { href: '/dashboard/audit-logs', key: 'audit_logs', icon: '◷', label: 'Audit log' }, { href: '/dashboard/operations', key: 'operations', icon: '▥', label: 'Reports & Analytics' }] as const;
  return <main className="admin-shell"><aside><div className="brand"><span /> Turf<span>Book</span>PK <b>Admin</b></div><nav>{nav.map((item) => <Link key={item.key} className={active === item.key ? 'active' : ''} href={item.href}><i aria-hidden="true">{item.icon}</i>{item.label}</Link>)}</nav><button className="signout" onClick={() => void leave()}><i aria-hidden="true">↪</i>Sign out</button></aside><section className="admin-main"><div className="admin-topbar"><div className="admin-topbar-title">Operations Console</div><div className="admin-profile"><span className="admin-avatar">A</span><span><b>Administrator</b><small>Internal operations</small></span></div></div><section className="content">{children}</section></section></main>;
}
