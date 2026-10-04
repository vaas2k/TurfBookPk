"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell, useAdminSession } from "../../../components/AdminShell";
import { request } from "../../../lib/api";

type Report = {
  id: string;
  status: "open" | "resolved" | "dismissed";
  reason: string;
  resolution_reason: string | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    is_hidden: boolean;
  };
  reporter: { full_name: string };
  ground: { title: string };
  created_at: string;
};
export default function ReviewsPage() {
  const ready = useAdminSession();
  const [items, setItems] = useState<Report[]>([]);
  const [status, setStatus] = useState<
    "open" | "resolved" | "dismissed" | "all"
  >("open");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  async function load() {
    if (!ready) return;
    try {
      setMessage("");
      setItems(
        ((await request("/review-reports")) as { reports: Report[] }).reports,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load review reports.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [ready]);
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          `${item.ground.title} ${item.reporter.full_name} ${item.reason} ${item.review.comment || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [items, query, status],
  );
  async function decide(
    item: Report,
    next: "resolved" | "dismissed",
    hide: boolean,
  ) {
    const reason = hide
      ? window.prompt("Reason for hiding this review:")
      : next === "dismissed"
        ? window.prompt("Optional dismissal note:")
        : "Reviewed by administrator";
    if (hide && !reason) return;
    setWorking(item.id);
    try {
      await request(`/review-reports/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, hide_review: hide, reason }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save moderation decision.",
      );
    } finally {
      setWorking(null);
    }
  }
  return (
    <AdminShell active="reviews">
      <header>
        <div>
          <p className="eyebrow">TRUST &amp; SAFETY</p>
          <h1>Review moderation</h1>
          <p className="muted compact">
            Handle reported reviews. Every resolution is recorded in the audit
            log.
          </p>
        </div>
        <button
          className="refresh"
          disabled={Boolean(working)}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      {message ? <p className="banner-error">{message}</p> : null}
      <div className="toolbar">
        <input
          placeholder="Search ground, reporter, reason…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="open">Open reports</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All reports</option>
        </select>
      </div>
      <section className="moderation-list">
        {visible.map((item) => (
          <article className="moderation-card" key={item.id}>
            <div className="moderation-card-head">
              <div>
                <p className="eyebrow">{item.status} report</p>
                <h2>
                  {item.ground.title}{" "}
                  <span className="review-rating">{item.review.rating}/5</span>
                </h2>
                <p className="muted compact">
                  Reported by {item.reporter.full_name} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <em
                className={`badge ${item.review.is_hidden ? "suspended" : item.status === "open" ? "pending" : "live"}`}
              >
                {item.review.is_hidden ? "review hidden" : item.status}
              </em>
            </div>
            <dl className="review-facts">
              <div>
                <dt>Report reason</dt>
                <dd>{item.reason}</dd>
              </div>
              <div>
                <dt>Review text</dt>
                <dd>{item.review.comment || "No written review"}</dd>
              </div>
              {item.resolution_reason ? (
                <div>
                  <dt>Resolution note</dt>
                  <dd>{item.resolution_reason}</dd>
                </div>
              ) : null}
            </dl>
            {item.status === "open" ? (
              <div className="review-actions">
                <button
                  disabled={Boolean(working)}
                  className="approve"
                  onClick={() => void decide(item, "resolved", false)}
                >
                  Keep review
                </button>
                <button
                  disabled={Boolean(working)}
                  className="danger"
                  onClick={() => void decide(item, "resolved", true)}
                >
                  Hide review
                </button>
                <button
                  disabled={Boolean(working)}
                  className="outline"
                  onClick={() => void decide(item, "dismissed", false)}
                >
                  Dismiss report
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {!visible.length ? (
          <p className="empty">No review reports match this view.</p>
        ) : null}
      </section>
    </AdminShell>
  );
}
