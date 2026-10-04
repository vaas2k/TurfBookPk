"use client";
import { useEffect, useState } from "react";
import { AdminShell, useAdminSession } from "../../../components/AdminShell";
import { request } from "../../../lib/api";
import { CsvExport, PageControls } from "../../../components/AdminListTools";
type Log = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
  actor: { full_name: string; phone: string | null };
};
export default function AuditLogsPage() {
  const ready = useAdminSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    if (!ready) return;
    try {
      const params = new URLSearchParams({ limit: "50", page: String(page) });
      if (type) params.set("target_type", type);
      const data = (await request(`/audit-logs?${params}`)) as { logs: Log[]; pagination: { has_more: boolean } }; setLogs(data.logs); setHasMore(data.pagination.has_more);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load audit records.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [ready, type, page]);
  return (
    <AdminShell active="audit_logs">
      <header>
        <div>
          <p className="eyebrow">ACCOUNTABILITY</p>
          <h1>Admin audit log</h1>
          <p className="muted compact">
            Every verification, moderation, suspension, and activation decision
            recorded by the platform.
          </p>
        </div>
        <div className="actions"><CsvExport rows={logs.map((log) => ({ when: log.created_at, administrator: log.actor.full_name || log.actor.phone, action: log.action, target_type: log.target_type, target_id: log.target_id, reason: log.reason }))} filename={`audit-log-page-${page}.csv`} columns={[{ key: "when", label: "When" }, { key: "administrator", label: "Administrator" }, { key: "action", label: "Action" }, { key: "target_type", label: "Target type" }, { key: "target_id", label: "Target ID" }, { key: "reason", label: "Reason" }]} /><button className="refresh" onClick={() => void load()}>Refresh</button></div>
      </header>
      {message ? <p className="banner-error">{message}</p> : null}
      <div className="toolbar">
        <select value={type} onChange={(event) => { setPage(1); setType(event.target.value); }}>
          <option value="">All target types</option>
          <option value="vendor">Vendors</option>
          <option value="ground">Grounds</option>
          <option value="user">Users</option>
          <option value="review_report">Review reports</option>
        </select>
      </div>
      <section className="data-table">
        <div className="table-head audit-table">
          <span>When</span>
          <span>Administrator</span>
          <span>Action</span>
          <span>Target</span>
          <span>Reason</span>
        </div>
        {logs.map((log) => (
          <div className="table-row audit-table" key={log.id}>
            <span>{new Date(log.created_at).toLocaleString()}</span>
            <span>
              {log.actor.full_name || log.actor.phone || "Administrator"}
            </span>
            <span>
              <b>{log.action.replaceAll("_", " ")}</b>
            </span>
            <span>
              {log.target_type} <small>{log.target_id.slice(0, 8)}…</small>
            </span>
            <span>{log.reason || "—"}</span>
          </div>
        ))}
        {!logs.length ? (
          <p className="empty">No audit records match this filter.</p>
        ) : null}
      </section>
      <PageControls page={page} hasMore={hasMore} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} />
    </AdminShell>
  );
}
