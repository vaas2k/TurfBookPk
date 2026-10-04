"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell, useAdminSession } from "../../../components/AdminShell";
import { request } from "../../../lib/api";
import { CsvExport, PageControls } from "../../../components/AdminListTools";
type Vendor = {
  id: string;
  business_name: string;
  business_city: string;
  business_phone: string;
  verification_status: string;
  is_active: boolean;
  owner: { full_name: string; phone: string | null };
};
const label = (value: string) => value.replace(/_/g, " ");
export default function VendorsPage() {
  const ready = useAdminSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    if (!ready) return;
    try {
      const result = (await request(`/vendors?status=all&page=${page}&limit=50`)) as { vendors: Vendor[]; pagination: { has_more: boolean } }; setVendors(result.vendors); setHasMore(result.pagination.has_more);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load vendors.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [ready, page]);
  return (
    <AdminShell active="vendors">
      <header className="verification-header">
        <div>
          <p className="eyebrow">VENDOR DIRECTORY</p>
          <h1>All vendors</h1>
          <p className="muted compact">
            Open a vendor to view their profile, account status, and every
            managed ground.
          </p>
        </div>
        <button className="refresh" onClick={() => void load()}>
          Refresh
        </button>
        <CsvExport rows={vendors.map((vendor) => ({ business: vendor.business_name, owner: vendor.owner.full_name, city: vendor.business_city, phone: vendor.business_phone, status: vendor.verification_status, active: vendor.is_active }))} filename={`vendors-page-${page}.csv`} columns={[{ key: "business", label: "Business" }, { key: "owner", label: "Owner" }, { key: "city", label: "City" }, { key: "phone", label: "Phone" }, { key: "status", label: "Verification" }, { key: "active", label: "Active" }]} />
      </header>
      {message ? <p className="banner-error">{message}</p> : null}
      <section className="verification-table">
        <div className="verification-table-head">
          <span>Business</span>
          <span>Owner</span>
          <span>City</span>
          <span>Status</span>
          <span />
        </div>
        {vendors.map((vendor) => (
          <Link
            className="verification-row"
            href={`/dashboard/vendors/${vendor.id}`}
            key={vendor.id}
          >
            <span className="vendor-cell">
              <b>{vendor.business_name}</b>
              <small>{vendor.business_phone}</small>
            </span>
            <span>
              {vendor.owner.full_name || vendor.owner.phone || "Unknown owner"}
            </span>
            <span>{vendor.business_city || "—"}</span>
            <span>
              <em
                className={`badge ${vendor.is_active ? "live" : "suspended"}`}
              >
                {label(vendor.verification_status)}
              </em>
            </span>
            <span className="review-link">View vendor →</span>
          </Link>
        ))}
        {!vendors.length ? (
          <p className="empty">No vendor profiles found.</p>
        ) : null}
      </section>
      <PageControls page={page} hasMore={hasMore} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} />
    </AdminShell>
  );
}
