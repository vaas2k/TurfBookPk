"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, useAdminSession } from "../../../../../../components/AdminShell";
import { request } from "../../../../../../lib/api";

type GroundDetail = {
  ground: { id: string; title: string; description: string | null; city: string; address: string; latitude: number | null; longitude: number | null; amenities: string[]; images: string[]; cover_image: string | null; pitch_type: string | null; price_per_hour: number; operating_hours: { open: string; close: string }; rules: string[]; cancellation_policy: string | null; is_active: boolean; is_verified: boolean; verification_status: string; verification_reason: string | null; rating: number; total_reviews: number; };
  vendor: { id: string; business_name: string; owner_name: string | null };
  reviews: { id: string; rating: number; comment: string | null; is_hidden: boolean; hidden_reason: string | null; created_at: string; player: { full_name: string | null } }[];
};
const label = (value: string) => value.replace(/_/g, " ");

export default function GroundAdminDetailPage() {
  const ready = useAdminSession();
  const { id: vendorId, groundId } = useParams<{ id: string; groundId: string }>();
  const [detail, setDetail] = useState<GroundDetail | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  async function load() {
    if (!ready || !groundId) return;
    try { setMessage(""); setDetail((await request(`/grounds/${groundId}`)) as GroundDetail); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load this ground."); }
  }
  useEffect(() => { void load(); }, [ready, groundId]);
  async function setAvailability() {
    if (!detail) return;
    const nextActive = !detail.ground.is_active;
    const reason = nextActive ? null : window.prompt("Why is this ground being suspended?");
    if (!nextActive && !reason) return;
    setWorking(true);
    try { await request(`/grounds/${detail.ground.id}/activation`, { method: "PATCH", body: JSON.stringify({ is_active: nextActive, reason }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update this ground."); }
    finally { setWorking(false); }
  }
  const photos = useMemo(() => detail ? [...new Set([detail.ground.cover_image, ...detail.ground.images].filter(Boolean) as string[])] : [], [detail]);
  const ground = detail?.ground;
  return <AdminShell active="vendors">
    <header className="review-page-header">
      <div><Link className="back-link" href={`/dashboard/vendors/${vendorId}`}>← Back to vendor</Link><p className="eyebrow">MANAGED GROUND</p><h1>{ground?.title || "Loading ground…"}</h1><p className="muted compact">{ground ? `${ground.city} · ${ground.address}` : ""}</p></div>
      <div className="ground-detail-actions">{ground ? <Link className="outline" href={`/dashboard/ground-verification/${ground.id}`}>Verification</Link> : null}{ground ? <button className={ground.is_active ? "danger" : "approve"} disabled={working} onClick={() => void setAvailability()}>{working ? "Saving…" : ground.is_active ? "Suspend" : "Restore"}</button> : null}<button className="refresh" onClick={() => void load()}>Refresh</button></div>
    </header>
    {message ? <p className="banner-error">{message}</p> : null}
    {detail && ground ? <main className="review-workspace ground-detail-workspace">
      <section className="review-card"><div className="review-card-head"><div><p className="eyebrow">GROUND SUMMARY</p><h2>{detail.vendor.business_name}</h2></div><em className={`review-status ${ground.is_verified ? "approved" : ""}`}>{label(ground.verification_status)}</em></div>
        {photos.length ? <div className="ground-photo-grid">{photos.map((photo) => <img key={photo} src={photo} alt={`${ground.title} photo`} />)}</div> : <p className="empty">No ground photos were submitted.</p>}
        <dl className="review-facts"><div><dt>Pitch type</dt><dd>{ground.pitch_type || "Not set"}</dd></div><div><dt>Base price</dt><dd>PKR {ground.price_per_hour.toLocaleString()} / hour</dd></div><div><dt>Hours</dt><dd>{ground.operating_hours.open} – {ground.operating_hours.close}</dd></div><div><dt>Rating</dt><dd>{ground.rating.toFixed(1)} · {ground.total_reviews} reviews</dd></div><div><dt>Coordinates</dt><dd>{ground.latitude ?? "—"}, {ground.longitude ?? "—"}</dd></div><div><dt>Vendor owner</dt><dd>{detail.vendor.owner_name || "—"}</dd></div></dl>
        <p className="ground-description">{ground.description || "No description provided."}</p>{ground.verification_reason ? <p className="review-reason">Verification note: {ground.verification_reason}</p> : null}
      </section>
      <section className="review-card"><div className="review-card-head"><div><p className="eyebrow">DETAILS</p><h2>Facilities, rules and policy</h2></div></div><div className="ground-detail-sections"><div><h3>Facilities</h3><p className="admin-chips">{ground.amenities.length ? ground.amenities.map((item) => <span key={item}>{item}</span>) : "No facilities listed."}</p></div><div><h3>Ground rules</h3><p className="admin-chips">{ground.rules.length ? ground.rules.map((item) => <span key={item}>{item}</span>) : "No rules listed."}</p></div><div><h3>Cancellation policy</h3><p className="muted compact">{ground.cancellation_policy ? label(ground.cancellation_policy) : "Not set"}</p></div></div></section>
      <section className="review-card"><div className="review-card-head"><div><p className="eyebrow">PLAYER FEEDBACK</p><h2>{detail.reviews.length} submitted reviews</h2></div><Link className="outline" href="/dashboard/reviews">Moderation queue</Link></div><div className="admin-review-list">{detail.reviews.map((review) => <article className="admin-review-item" key={review.id}><div><b>{review.player.full_name || "Player"}</b><p className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span>{"★".repeat(5 - review.rating)}</span></p></div><time>{new Date(review.created_at).toLocaleDateString()}</time>{review.is_hidden ? <em className="badge suspended">Hidden</em> : <em className="badge live">Visible</em>}<p>{review.comment || "No written comment."}</p>{review.hidden_reason ? <small>Hidden: {review.hidden_reason}</small> : null}</article>)}{!detail.reviews.length ? <p className="empty">This ground has no reviews yet.</p> : null}</div></section>
    </main> : null}
  </AdminShell>;
}
