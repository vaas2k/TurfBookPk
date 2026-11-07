"use client";
import { useEffect, useState } from "react";
import { AdminShell, useAdminSession } from "../../../components/AdminShell";
import { request } from "../../../lib/api";
type Dispute = {
  id: string;
  booking_number: string;
  player_name: string;
  vendor_name: string;
  ground_title: string;
  status: string;
  category: string;
  description: string;
  vendor_response: string | null;
  vendor_responded_at: string | null;
  vendor_appeal: string | null;
  appealed_at: string | null;
  responsibility: string | null;
  resolution: string | null;
  refund_amount: number;
  vendor_hold_amount: number;
};
const money = (value: number) => `Rs ${value.toLocaleString()}`;
export default function DisputesPage() {
  const ready = useAdminSession();
  const [items, setItems] = useState<Dispute[]>([]);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [booking, setBooking] = useState("");
  const [category, setCategory] = useState("service_issue");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState<"refund" | "no_refund">(
    "refund",
  );
  const [responsibility, setResponsibility] = useState("shared");
  const [amount, setAmount] = useState("");
  const [working, setWorking] = useState(false);
  async function load() {
    if (!ready) return;
    try {
      const data = (await request("/financial-disputes")) as {
        disputes: Dispute[];
      };
      setItems(data.disputes);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load disputes.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [ready]);
  async function open() {
    setWorking(true);
    try {
      await request("/financial-disputes", {
        method: "POST",
        body: JSON.stringify({
          booking_number: booking,
          category,
          description,
        }),
      });
      setBooking("");
      setDescription("");
      setSuccess("Dispute opened. The vendor earning is held from payout.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to open dispute.",
      );
    } finally {
      setWorking(false);
    }
  }
  async function resolve() {
    if (!selected) return;
    setWorking(true);
    try {
      await request(`/financial-disputes/${selected.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution,
          responsibility,
          refund_amount: resolution === "refund" ? Number(amount) : 0,
        }),
      });
      setSelected(null);
      setSuccess(
        resolution === "refund"
          ? "Refund case added to the refund queue."
          : "Dispute closed and vendor hold released.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to resolve dispute.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <AdminShell active="refunds">
      <header>
        <div>
          <p className="eyebrow">MONEY OPERATIONS</p>
          <h1>Disputes</h1>
          <p className="muted compact">
            Hold vendor earnings while a booking issue is reviewed, then record
            a clear outcome.
          </p>
        </div>
        <button
          className="outline"
          onClick={() => (location.href = "/dashboard/refunds")}
        >
          Refund queue
        </button>
      </header>
      {message ? <p className="banner-error">{message}</p> : null}
      {success ? <p className="banner-success">{success}</p> : null}
      <section className="panel">
        <h2>Open a dispute</h2>
        <div className="ops-form">
          <label>
            Booking number
            <input
              value={booking}
              onChange={(e) => setBooking(e.target.value)}
              placeholder="TB-…"
            />
          </label>
          <label>
            Issue type
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="service_issue">Service issue</option>
              <option value="venue_cancelled">Venue cancelled</option>
              <option value="payment_issue">Payment issue</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="wide">
            What happened?
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            className="approve wide"
            disabled={working || !booking || !description}
            onClick={() => void open()}
          >
            Open dispute and hold earning
          </button>
        </div>
      </section>
      <section className="data-table" style={{ marginTop: 20 }}>
        <div className="table-head refund-table">
          <span>Booking / player</span>
          <span>Vendor / ground</span>
          <span>Issue</span>
          <span>Held</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {items.map((item) => (
          <div className="table-row refund-table" key={item.id}>
            <span>
              <b>{item.booking_number}</b>
              <small>{item.player_name}</small>
            </span>
            <span>
              <b>{item.vendor_name}</b>
              <small>{item.ground_title}</small>
            </span>
            <span>
              <b>{item.category.replaceAll("_", " ")}</b>
              <small>{item.description}</small>
            </span>
            <span>{money(item.vendor_hold_amount)}</span>
            <span>
              <em
                className={
                  item.status === "resolved" ? "badge live" : "badge pending"
                }
              >
                {item.status}
              </em>
            </span>
            <span>
              <button
                className="outline"
                onClick={() => {
                  setSelected(item);
                  setAmount(item.refund_amount ? String(item.refund_amount) : "");
                }}
              >
                {item.status === "resolved" ? "View" : "Review"}
              </button>
            </span>
          </div>
        ))}
      </section>
      {selected ? (
        <div className="ops-modal-backdrop">
          <section className="ops-modal">
            <div className="ops-modal-head">
              <h2>Resolve {selected.booking_number}</h2>
              <button
                className="close-button"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <div className="review-reason">
              <b>Player report</b>
              <p>{selected.description}</p>
            </div>
            <div className="review-reason">
              <b>Venue response</b>
              <p>{selected.vendor_response || "The venue has not responded yet."}</p>
            </div>
            {selected.vendor_appeal ? (
              <div className="review-reason">
                <b>Venue appeal</b>
                <p>{selected.vendor_appeal}</p>
              </div>
            ) : null}
            {selected.status !== "resolved" ? <div className="ops-form">
              <label>
                Outcome
                <select
                  value={resolution}
                  onChange={(e) =>
                    setResolution(e.target.value as "refund" | "no_refund")
                  }
                >
                  <option value="refund">Refund player</option>
                  <option value="no_refund">Close without refund</option>
                </select>
              </label>
              {resolution === "refund" ? (
                <>
                  <label>
                    Responsibility
                    <select
                      value={responsibility}
                      onChange={(e) => setResponsibility(e.target.value)}
                    >
                      <option value="shared">Normal split</option>
                      <option value="vendor">Vendor pays all</option>
                      <option value="platform">TurfBookPK pays all</option>
                    </select>
                  </label>
                  <label className="wide">
                    Refund amount
                    <input
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </label>
                </>
              ) : null}
              <button
                className="approve wide"
                disabled={
                  working || (resolution === "refund" && !Number(amount))
                }
                onClick={() => void resolve()}
              >
                Confirm resolution
              </button>
            </div> : <p className="banner-success">Decision: {selected.resolution?.replaceAll("_", " ") || "resolved"}{selected.refund_amount ? ` · ${money(selected.refund_amount)}` : ""}</p>}
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
