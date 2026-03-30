"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface ChangeLogEntry {
  id: string;
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: changelog = [], isLoading } = useQuery<ChangeLogEntry[]>({
    queryKey: ["changelog", id],
    queryFn: () => fetch(`/api/projects/${id}/budget/changelog`).then((r) => r.json()),
  });

  const getChangeIcon = (type: string) => {
    if (type === "create") return { bg: "var(--green-subtle)", color: "var(--green)", label: "Created" };
    if (type === "delete") return { bg: "var(--red-subtle)", color: "var(--red)", label: "Deleted" };
    return { bg: "var(--blue-subtle)", color: "var(--blue-primary)", label: "Updated" };
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="skeleton w-64 h-8 rounded-md" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-12 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h1 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
          Version History
        </h1>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          {changelog.length} changes recorded
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {changelog.length === 0 ? (
          <div className="sf-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" className="mb-5">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="sf-empty-title">No history yet</h3>
            <p className="sf-empty-desc">Changes to your schedule and budget will appear here.</p>
          </div>
        ) : (
          <div className="max-w-[700px] mx-auto py-6 px-6">
            {/* Timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "var(--border-subtle)" }} />

              {changelog.map((entry, idx) => {
                const meta = getChangeIcon(entry.changeType);
                return (
                  <div key={entry.id} className="relative pl-14 pb-8">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: meta.bg, top: 2 }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                    </div>

                    <div className="sf-card" style={{ padding: "12px 16px" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.changeType === "create" ? "success" : entry.changeType === "delete" ? "critical" : "ai"}>
                            {meta.label}
                          </Badge>
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
                            {entry.fieldName}
                          </span>
                        </div>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>

                      {(entry.oldValue || entry.newValue) && (
                        <div className="flex items-center gap-2 mt-2" style={{ fontSize: "var(--text-sm)" }}>
                          {entry.oldValue && (
                            <span className="text-mono-num" style={{ color: "var(--red)", textDecoration: "line-through" }}>
                              {entry.oldValue}
                            </span>
                          )}
                          {entry.oldValue && entry.newValue && (
                            <span style={{ color: "var(--text-tertiary)" }}>→</span>
                          )}
                          {entry.newValue && (
                            <span className="text-mono-num" style={{ color: "var(--green)" }}>
                              {entry.newValue}
                            </span>
                          )}
                        </div>
                      )}

                      {entry.reason && (
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4, fontStyle: "italic" }}>
                          {entry.reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
