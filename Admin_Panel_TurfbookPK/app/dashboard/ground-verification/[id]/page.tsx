'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell, useAdminSession } from '../../../../components/AdminShell';
import { request } from '../../../../lib/api';

type VerificationDocument = { id: string; type: string; contentType: string; originalFilename: string | null };
type Detail = {
  ground: { id: string; title: string; description: string | null; location: string; city: string; address: string; latitude: number | null; longitude: number | null; images: string[]; cover_image: string | null; pitch_type: string | null; amenities: string[]; price_per_hour: number; operating_hours: { open: string; close: string }; cancellation_policy: string | null; verification_status: string };
  vendor: { business_name: string; owner_name: string };
  verification: { status: string; authority_status: string; authority_reason: string | null; relationship: string | null; document_expiry_date: string | null; documents: VerificationDocument[] } | null;
};
const label = (value?: string | null) => (value || 'Not submitted').replaceAll('_', ' ');

export default function GroundReviewPage() {
  const ready = useAdminSession();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  async function load() { if (!ready || !id) return; try { setMessage(''); setDetail(await request(`/grounds/${id}/verification`) as Detail); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load ground verification.'); } }
  useEffect(() => { void load(); }, [ready, id]);
  async function act(action: 'approved' | 'rejected' | 'changes_requested') { const reason = action === 'approved' ? null : window.prompt(action === 'rejected' ? 'Reason for rejection:' : 'What needs to be changed?'); if (action !== 'approved' && !reason) return; setWorking(true); try { await request(`/grounds/${id}/verification/review`, { method: 'PATCH', body: JSON.stringify({ action, reason }) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save review.'); } finally { setWorking(false); } }
  async function approve() { setWorking(true); try { await request(`/grounds/${id}/approve`, { method: 'POST' }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to approve ground.'); } finally { setWorking(false); } }
  async function openDocument(documentId: string) { try { const result = await request(`/ground-verification-documents/${documentId}/download`) as { download_url: string }; window.open(result.download_url, '_blank', 'noopener,noreferrer'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open private document.'); } }
  const ground = detail?.ground;
  const verification = detail?.verification;
  const authorityStatus = verification?.authority_status;
  return <AdminShell active="ground_verification">
    <header className="review-page-header"><div><Link className="back-link" href="/dashboard/ground-verification">← Back to queue</Link><p className="eyebrow">GROUND APPLICATION</p><h1>{ground?.title || 'Loading application…'}</h1><p className="muted compact">{detail ? `${detail.vendor.business_name} · ${ground?.city}` : ''}</p></div><button className="refresh" disabled={working} onClick={() => void load()}>Refresh</button></header>
    {message ? <p className="banner-error">{message}</p> : null}{!detail && !message ? <p className="empty">Loading verification details…</p> : null}
    {detail && ground ? <main className="review-workspace">
      <section className="review-overview"><span>Application status</span><strong>{label(verification?.status || ground.verification_status)}</strong><p>Approve the authority proof before making the final listing decision.</p></section>
      <section className="review-card"><div className="review-card-head"><div><p className="eyebrow">LISTING DETAILS</p><h2>Ground, location, pricing &amp; timing</h2></div></div><p className="muted compact">{ground.description || 'No description provided.'}</p><dl className="review-facts"><div><dt>Address</dt><dd>{ground.address}, {ground.city}</dd></div><div><dt>Coordinates</dt><dd>{ground.latitude ?? '—'}, {ground.longitude ?? '—'}</dd></div><div><dt>Pitch / price</dt><dd>{ground.pitch_type || 'Not specified'} · Rs {ground.price_per_hour}/hr</dd></div><div><dt>Operating hours</dt><dd>{ground.operating_hours.open}–{ground.operating_hours.close}</dd></div><div><dt>Cancellation policy</dt><dd>{label(ground.cancellation_policy)}</dd></div></dl><p className="muted compact"><b>Amenities:</b> {ground.amenities.join(', ') || 'None listed'}</p><div className="ground-photo-grid">{ground.images.map((src) => <img key={src} src={src} alt="Ground submission" />)}</div></section>
      {verification ? <section className={`review-card decision-${authorityStatus}`}><div className="review-card-head"><div><p className="eyebrow">AUTHORITY PROOF</p><h2>{label(verification.relationship)}</h2></div><em className={`review-status ${authorityStatus}`}>{authorityStatus === 'approved' ? '✓ Approved' : label(authorityStatus)}</em></div>{verification.authority_reason ? <p className="banner-error">Latest review note: {verification.authority_reason}</p> : null}<dl className="review-facts"><div><dt>Document expiry</dt><dd>{verification.document_expiry_date || 'Not specified'}</dd></div><div><dt>Submitted proof</dt><dd>{verification.documents.length} private document(s)</dd></div></dl><div className="document-list">{verification.documents.map((document) => <button key={document.id} className="outline" onClick={() => void openDocument(document.id)}>Open {label(document.type)}{document.originalFilename ? ` (${document.originalFilename})` : ''}</button>)}</div><div className="review-actions"><button disabled={working || authorityStatus === 'approved'} className={`approve ${authorityStatus === 'approved' ? 'decision-selected' : ''}`} onClick={() => void act('approved')}>{authorityStatus === 'approved' ? '✓ Proof approved' : 'Approve proof'}</button><button disabled={working || authorityStatus === 'changes_requested'} className={`outline ${authorityStatus === 'changes_requested' ? 'decision-selected' : ''}`} onClick={() => void act('changes_requested')}>{authorityStatus === 'changes_requested' ? 'Changes requested' : 'Request changes'}</button><button disabled={working || authorityStatus === 'rejected'} className={`danger ${authorityStatus === 'rejected' ? 'decision-selected' : ''}`} onClick={() => void act('rejected')}>{authorityStatus === 'rejected' ? 'Rejected' : 'Reject'}</button></div>{authorityStatus === 'approved' ? <p className="decision-saved">This proof approval is saved. Use the final button below when the entire ground review is complete.</p> : null}</section> : null}
      {authorityStatus === 'approved' ? <section className="final-approval"><div><p className="eyebrow">FINAL DECISION</p><h2>Authority proof approved</h2><p>Approve this ground to publish it and allow bookings.</p></div><button disabled={working || verification?.status === 'approved'} className="approve" onClick={() => void approve()}>{verification?.status === 'approved' ? 'Ground approved' : 'Approve ground'}</button></section> : null}
    </main> : null}
  </AdminShell>;
}
