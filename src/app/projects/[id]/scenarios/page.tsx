"use client";
import { useState, use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Schedule {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  blockedDates: { id: string; date: string; reason: string }[];
}

interface ShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  scenes: { id: string; sceneNumber: string; pageCount: number; sceneName: string }[];
}

export default function ScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules", id],
    queryFn: () => fetch(`/api/projects/${id}/schedules`).then((r) => r.json()),
  });

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const days: ShootDay[] = project?.shootDays || [];

  const toggleSchedule = (sid: string) => {
    setSelectedIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : prev.length < 3 ? [...prev, sid] : prev
    );
  };

  // Calculate stats for comparison
  const getScheduleStats = (schedule: Schedule) => {
    const totalDays = days.length;
    const totalScenes = days.reduce((s, d) => s + d.scenes.length, 0);
    const totalPages = days.reduce((s, d) => s + d.scenes.reduce((p, sc) => p + sc.pageCount, 0), 0);
    const avgPagesPerDay = totalDays > 0 ? totalPages / totalDays : 0;
    const blockedCount = schedule.blockedDates?.length || 0;
    return { totalDays, totalScenes, totalPages, avgPagesPerDay, blockedCount };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 h-12 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
            Scenario Comparison
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            Select up to 3 schedules to compare
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {schedules.length === 0 ? (
          <div className="sf-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" className="mb-5">
              <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="sf-empty-title">No schedules to compare</h3>
            <p className="sf-empty-desc">Create multiple schedule versions to compare scenarios side by side.</p>
            <Button onClick={() => (window.location.href = `/projects/${id}/schedule/setup`)}>Create Schedule</Button>
          </div>
        ) : (
          <>
            {/* Schedule Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {schedules.map((schedule) => {
                const stats = getScheduleStats(schedule);
                const isSelected = selectedIds.includes(schedule.id);
                return (
                  <div
                    key={schedule.id}
                    onClick={() => toggleSchedule(schedule.id)}
                    className="sf-card cursor-pointer transition-all"
                    style={{
                      border: isSelected ? "2px solid var(--blue-primary)" : "1px solid var(--border-default)",
                      background: isSelected ? "var(--blue-subtle)" : "var(--bg-surface-1)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                        {schedule.name}
                      </h3>
                      {isSelected && <Badge variant="ai">Selected</Badge>}
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Shoot Days", value: stats.totalDays },
                        { label: "Scenes", value: stats.totalScenes },
                        { label: "Total Pages", value: stats.totalPages.toFixed(1) },
                        { label: "Avg pp/day", value: stats.avgPagesPerDay.toFixed(1) },
                        { label: "Blocked Dates", value: stats.blockedCount },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                          <span className="text-mono-num" style={{ color: "var(--text-primary)" }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {schedule.startDate && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                        {schedule.startDate} → {schedule.endDate || "TBD"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Comparison Table */}
            {selectedIds.length >= 2 && (
              <div className="sf-card">
                <h3 className="text-tier-1 mb-4">Side-by-Side Comparison</h3>
                <table className="sf-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {selectedIds.map((sid) => {
                        const s = schedules.find((x) => x.id === sid);
                        return <th key={sid}>{s?.name || "—"}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {["Shoot Days", "Total Pages", "Avg pp/day", "Blocked Dates", "Start Date", "End Date"].map((metric) => (
                      <tr key={metric}>
                        <td style={{ color: "var(--text-secondary)" }}>{metric}</td>
                        {selectedIds.map((sid) => {
                          const s = schedules.find((x) => x.id === sid);
                          if (!s) return <td key={sid}>—</td>;
                          const stats = getScheduleStats(s);
                          let value = "—";
                          if (metric === "Shoot Days") value = String(stats.totalDays);
                          if (metric === "Total Pages") value = stats.totalPages.toFixed(1);
                          if (metric === "Avg pp/day") value = stats.avgPagesPerDay.toFixed(1);
                          if (metric === "Blocked Dates") value = String(stats.blockedCount);
                          if (metric === "Start Date") value = s.startDate || "—";
                          if (metric === "End Date") value = s.endDate || "—";
                          return <td key={sid} className="cell-mono">{value}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
