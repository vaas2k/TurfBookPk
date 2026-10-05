"use client";
import { useEffect, useState } from "react";
import { AdminShell, useAdminSession } from "../../../components/AdminShell";
import { request } from "../../../lib/api";
import { CsvExport, PageControls } from "../../../components/AdminListTools";
type Refund = {
  id: string;
  booking_number: string;
  ground_title: string;
  player_name: string;
  vendor_name: string;
  amount: number;
  status: string;
  reason: string | null;
  cancelled_at: string | null;
};
export default function RefundsPage() {
  const ready = useAdminSession();
  const [items, setItems] = useState<Refund[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (ready)
      void request(`/refunds?q=${encodeURIComponent(query)}&page=${page}&limit=50`)
        .then((value) => { const data = value as { refunds: Refund[]; pagination: { has_more: boolean } }; setItems(data.refunds); setHasMore(data.pagination.has_more); })
        .catch((error) =>
          setMessage(
            error instanceof Error ? error.message : "Unable to load refunds.",
          ),
        );
  }, [ready, query, page]);
  return (
    <AdminShell active="refunds">
      <header>
        <div>
          <p className="eyebrow">REFUNDS &amp; DISPUTES</p>
          <h1>Refund records</h1>
        </div>
        <CsvExport rows={items.map((item) => ({ booking: item.booking_number, ground: item.ground_title, player: item.player_name, vendor: item.vendor_name, amount_pkr: item.amount, status: item.status, reason: item.reason, cancelled_at: item.cancelled_at }))} filename={`refunds-page-${page}.csv`} columns={[{ key: "booking", label: "Booking" }, { key: "ground", label: "Ground" }, { key: "player", label: "Player" }, { key: "vendor", label: "Vendor" }, { key: "amount_pkr", label: "Amount PKR" }, { key: "status", label: "Status" }, { key: "reason", label: "Reason" }, { key: "cancelled_at", label: "Cancelled at" }]} />
      </header>
      <p className="muted compact">
        Refund calculations are recorded here. Gateway settlement actions remain
        disabled until provider webhooks are available.
      </p>
      {message && <p className="banner-error">{message}</p>}
      <div className="toolbar"><input placeholder="Search booking, ground, player…" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></div>
      <section className="data-table">
        <div className="table-head transaction-table">
          <span>Booking</span>
          <span>Ground</span>
          <span>Player / vendor</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Cancelled</span>
        </div>
        {items.map((item) => (
          <div className="table-row transaction-table" key={item.id}>
            <span>
              <b>{item.booking_number}</b>
              <small>{item.reason || "Cancellation"}</small>
            </span>
            <span>{item.ground_title}</span>
            <span>
              {item.player_name} <small>→ {item.vendor_name}</small>
            </span>
            <span>
              <b>Rs {item.amount.toLocaleString()}</b>
            </span>
            <span>
              <em
                className={
                  item.status === "refunded" ? "badge live" : "badge pending"
                }
              >
                {item.status.replace("_", " ")}
              </em>
            </span>
            <span>
              {item.cancelled_at
                ? new Date(item.cancelled_at).toLocaleDateString()
                : "—"}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="empty">No refundable cancellations are recorded.</p>
        )}
      </section>
      <PageControls page={page} hasMore={hasMore} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} />
    </AdminShell>
  );
}
