'use client';

import { useEffect, useState } from 'react';
import { request } from '../../lib/api';
import { AdminShell } from '../../components/AdminShell';

type Counts = { pending_vendors: number; pending_grounds: number; open_review_reports: number; suspended_users: number; total_users: number; active_verified_grounds: number };
type QueueItem = { id: string; business_name?: string; title?: string; business_city?: string; city?: string; verification_status: string; created_at: string };
type Report = { id: string; reason: string; status: string; review: { rating: number; comment: string | null; is_hidden: boolean }; ground: { title: string }; reporter: { full_name: string } };
const empty: Counts = { pending_vendors: 0, pending_grounds: 0, open_review_reports: 0, suspended_users: 0, total_users: 0, active_verified_grounds: 0 };

export default function DashboardPage() {
  const [name] = useState('Administrator');
  const [counts, setCounts] = useState<Counts>(empty); const [vendors, setVendors] = useState<QueueItem[]>([]); const [grounds, setGrounds] = useState<QueueItem[]>([]); const [reports, setReports] = useState<Report[]>([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setMessage('');
    try {
      const [dashboard, vendorQueue, groundQueue, reportQueue] = await Promise.all([
        request('/dashboard') as Promise<{ counts: Counts }>, request('/vendors?status=pending') as Promise<{ vendors: QueueItem[] }>, request('/grounds?status=pending') as Promise<{ grounds: QueueItem[] }>, request('/review-reports') as Promise<{ reports: Report[] }>,
      ]);
      setCounts(dashboard.counts); setVendors(vendorQueue.vendors); setGrounds(groundQueue.grounds); setReports(reportQueue.reports.filter((report) => report.status === 'open'));
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function decide(kind: 'vendors' | 'grounds', id: string, status: 'approved' | 'rejected') { const reason = status === 'rejected' ? window.prompt('Reason for rejection (shown to the owner):') : null; if (status === 'rejected' && !reason) return; try { await request(`/${kind}/${id}/verification`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }); await load(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Action failed.'); } }
  async function resolveReport(id: string, hide: boolean) { try { await request(`/review-reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', hide_review: hide, reason: hide ? 'Hidden after administrator review' : 'No action required' }) }); await load(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Action failed.'); } }
  const cards = [['Pending vendors', counts.pending_vendors], ['Pending grounds', counts.pending_grounds], ['Open review reports', counts.open_review_reports], ['Active verified grounds', counts.active_verified_grounds], ['Total users', counts.total_users], ['Suspended users', counts.suspended_users]];
  return <AdminShell active="dashboard"><header><div><p className="eyebrow">MARKETPLACE OPERATIONS</p><h1>Welcome back, {name}</h1></div><button className="refresh" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh data'}</button></header>{message && <p className="banner-error">{message}</p>}<section className="stat-grid">{cards.map(([label, value]) => <article className="stat" key={String(label)}><small>{label}</small><strong>{value}</strong></article>)}</section><Queue title="Vendor approvals" id="vendors" items={vendors} getName={(item) => item.business_name || 'Vendor'} getDetail={(item) => item.business_city || ''} onDecision={(id, status) => void decide('vendors', id, status)} /><Queue title="Ground approvals" id="grounds" items={grounds} getName={(item) => item.title || 'Ground'} getDetail={(item) => item.city || ''} onDecision={(id, status) => void decide('grounds', id, status)} /><section className="queue" id="reports"><div className="queue-title"><h2>Review moderation</h2><span>{reports.length} open</span></div>{reports.length === 0 ? <Empty text="No review reports need attention." /> : reports.map((report) => <article className="report-row" key={report.id}><div><b>{report.ground.title} - {report.review.rating}/5</b><p>Reported by {report.reporter.full_name}: {report.reason}</p><blockquote>{report.review.comment || 'No written review'}</blockquote></div><div className="actions"><button className="outline" onClick={() => void resolveReport(report.id, false)}>Dismiss</button><button className="danger" onClick={() => void resolveReport(report.id, true)}>Hide review</button></div></article>)}</section></AdminShell>;
}

function Queue({ title, id, items, getName, getDetail, onDecision }: { title: string; id: string; items: QueueItem[]; getName: (item: QueueItem) => string; getDetail: (item: QueueItem) => string; onDecision: (id: string, status: 'approved' | 'rejected') => void }) { return <section className="queue" id={id}><div className="queue-title"><h2>{title}</h2><span>{items.length} pending</span></div>{items.length === 0 ? <Empty text={`No ${title.toLowerCase()} right now.`} /> : items.map((item) => <article className="queue-row" key={item.id}><div><b>{getName(item)}</b><p>{getDetail(item)} · Submitted {new Date(item.created_at).toLocaleDateString()}</p></div><div className="actions"><button className="outline" onClick={() => onDecision(item.id, 'rejected')}>Reject</button><button className="approve" onClick={() => onDecision(item.id, 'approved')}>Approve</button></div></article>)}</section>; }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p>; }
