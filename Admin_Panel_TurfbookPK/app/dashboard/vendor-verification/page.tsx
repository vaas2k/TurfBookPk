'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell, useAdminSession } from '../../../components/AdminShell';
import { request } from '../../../lib/api';

type Vendor = { id: string; business_name: string; business_city: string; verification_status: string; owner: { full_name: string; phone: string | null } };
const label = (status: string) => status.replace(/_/g, ' ');

export default function VendorVerificationPage() {
  const ready = useAdminSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [message, setMessage] = useState('');
  async function load() { if (!ready) return; try { setMessage(''); setVendors((await request('/vendors?status=under_review&include_changes_requested=true') as { vendors: Vendor[] }).vendors); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load vendor queue.'); } }
  useEffect(() => { void load(); }, [ready]);
  return <AdminShell active="vendor_verification"><header className="verification-header"><div><p className="eyebrow">VENDOR COMPLIANCE</p><h1>Verification queue</h1><p className="muted compact">Review identity, business proof, and payout details in three clear decisions.</p></div><button className="refresh" onClick={() => void load()}>Refresh queue</button></header>{message ? <p className="banner-error">{message}</p> : null}<section className="verification-summary"><strong>{vendors.length}</strong><span>applications awaiting review</span><p>Open an application to review every document and decision in a dedicated workspace.</p></section><section className="verification-table" aria-label="Vendor verification applications"><div className="verification-table-head"><span>Business</span><span>Applicant</span><span>Location</span><span>Status</span><span /></div>{vendors.map((vendor) => <Link className="verification-row" key={vendor.id} href={`/dashboard/vendor-verification/${vendor.id}`}><span className="vendor-cell"><b>{vendor.business_name}</b><small>{vendor.owner.phone || 'Phone unavailable'}</small></span><span>{vendor.owner.full_name || 'Unnamed applicant'}</span><span>{vendor.business_city || 'City not provided'}</span><span><em className="badge pending">{label(vendor.verification_status)}</em></span><span className="review-link">Open review →</span></Link>)}{!vendors.length ? <p className="empty">No vendor applications are waiting for review.</p> : null}</section></AdminShell>;
}
