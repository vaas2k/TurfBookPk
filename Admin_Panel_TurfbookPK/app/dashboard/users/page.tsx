'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell, useAdminSession } from '../../../components/AdminShell';
import { request } from '../../../lib/api';

type User = { id: string; full_name: string; phone: string | null; city: string | null; role: string; is_suspended: boolean; created_at: string };
export default function UsersPage() {
  const token = useAdminSession(); const [users, setUsers] = useState<User[]>([]); const [query, setQuery] = useState(''); const [message, setMessage] = useState('');
  async function load() { if (!token) return; try { const data = await request('/users') as { users: User[] }; setUsers(data.users); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load users.'); } }
  useEffect(() => { void load(); }, [token]); const filtered = useMemo(() => users.filter((user) => `${user.full_name} ${user.phone || ''} ${user.city || ''}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  async function toggle(user: User) { const reason = user.is_suspended ? null : window.prompt('Reason for suspension:'); if (!user.is_suspended && !reason) return; await request(`/users/${user.id}/suspension`, { method: 'PATCH', body: JSON.stringify({ is_suspended: !user.is_suspended, reason }) }); void load(); }
  return <AdminShell active="users"><header><div><p className="eyebrow">ACCOUNT OPERATIONS</p><h1>Users &amp; Owners <small>({users.length} total)</small></h1></div></header>{message && <p className="banner-error">{message}</p>}<div className="toolbar"><input placeholder="Search by name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><section className="data-table"><div className="table-head user-table"><span>Name</span><span>Phone number</span><span>City</span><span>Role</span><span>Status</span><span /></div>{filtered.map((user) => <div className="table-row user-table" key={user.id}><span><b>{user.full_name}</b><small>Joined {new Date(user.created_at).toLocaleDateString()}</small></span><span>{user.phone || '—'}</span><span>{user.city || '—'}</span><span className="capitalize">{user.role}</span><span><em className={user.is_suspended ? 'badge suspended' : 'badge live'}>{user.is_suspended ? 'suspended' : 'active'}</em></span><button className={user.is_suspended ? 'approve' : 'outline'} onClick={() => void toggle(user)}>{user.is_suspended ? 'Restore' : 'Suspend'}</button></div>)}{filtered.length === 0 && <p className="empty">No users match this search.</p>}</section></AdminShell>;
}
