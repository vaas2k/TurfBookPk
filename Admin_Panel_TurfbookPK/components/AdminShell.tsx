"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { request, signOut } from "../lib/api";

type AttentionCounts = {
  vendor_verification: number;
  ground_verification: number;
  refunds: number;
  disputes: number;
  payouts: number;
  reviews: number;
};

export function useAdminSession(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, [router]);
  return ready;
}

export function AdminShell({
  children,
  active,
}: {
  children: ReactNode;
  active:
    | "dashboard"
    | "grounds"
    | "ground_verification"
    | "users"
    | "reviews"
    | "transactions"
    | "platform_finance"
    | "operations"
    | "refunds"
    | "payouts"
    | "commission"
    | "vendor_verification"
    | "vendors"
    | "audit_logs";
}) {
  const router = useRouter();
  const [attention, setAttention] = useState<AttentionCounts | null>(null);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = (await request("/attention-counts")) as AttentionCounts;
        if (mounted) setAttention(result);
      } catch {
        // Page-level requests continue to surface operational errors.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);
  async function leave() {
    await signOut().catch(() => undefined);
    router.replace("/login");
  }
  const nav = [
    { href: "/dashboard", key: "dashboard", icon: "◔", label: "Dashboard" },
    {
      href: "/dashboard/vendors",
      key: "vendors",
      icon: "◉",
      label: "Vendors & grounds",
    },
    {
      href: "/dashboard/users",
      key: "users",
      icon: "♙",
      label: "Users & Owners",
    },
    {
      href: "/dashboard/transactions",
      key: "transactions",
      icon: "▣",
      label: "Transactions",
    },
    {
      href: "/dashboard/platform-finance",
      key: "platform_finance",
      icon: "₨",
      label: "TurfBookPK earnings",
    },
    {
      href: "/dashboard/refunds",
      key: "refunds",
      icon: "↙",
      label: "Refunds & Disputes",
    },
    {
      href: "/dashboard/payouts",
      key: "payouts",
      icon: "₹",
      label: "Vendor payouts",
    },
    {
      href: "/dashboard/vendor-verification",
      key: "vendor_verification",
      icon: "✓",
      label: "Vendor verification",
    },
    {
      href: "/dashboard/ground-verification",
      key: "ground_verification",
      icon: "⌂",
      label: "Ground verification",
    },
    {
      href: "/dashboard/reviews",
      key: "reviews",
      icon: "✕",
      label: "Reviews Moderation",
    },
    {
      href: "/dashboard/audit-logs",
      key: "audit_logs",
      icon: "◷",
      label: "Audit log",
    },
    {
      href: "/dashboard/operations",
      key: "operations",
      icon: "▥",
      label: "Reports & Analytics",
    },
  ] as const;
  const attentionFor = (key: (typeof nav)[number]["key"]): number => {
    if (key === "refunds") return (attention?.refunds ?? 0) + (attention?.disputes ?? 0);
    if (key === "payouts") return attention?.payouts ?? 0;
    if (key === "vendor_verification") return attention?.vendor_verification ?? 0;
    if (key === "ground_verification") return attention?.ground_verification ?? 0;
    if (key === "reviews") return attention?.reviews ?? 0;
    return 0;
  };
  return (
    <main className="admin-shell">
      <aside>
        <div className="brand">
          <span /> Turf<span>Book</span>PK <b>Admin</b>
        </div>
        <nav>
          {nav.map((item) => {
            const count = attentionFor(item.key);
            return <Link key={item.key} className={active === item.key ? "active" : ""} href={item.href}>
              <i aria-hidden="true">{item.icon}</i><span className="nav-label">{item.label}</span>
              {count > 0 ? <span className="nav-attention" aria-label={`${count} items require attention`}>{count > 99 ? "99+" : count}</span> : null}
            </Link>;
          })}
        </nav>
        <button className="signout" onClick={() => void leave()}>
          <i aria-hidden="true">↪</i>Sign out
        </button>
      </aside>
      <section className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-title">Operations Console</div>
          <div className="admin-profile">
            <span className="admin-avatar">A</span>
            <span>
              <b>Administrator</b>
              <small>Internal operations</small>
            </span>
          </div>
        </div>
        <section className="content">{children}</section>
      </section>
    </main>
  );
}
