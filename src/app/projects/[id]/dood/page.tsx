"use client";
import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  shootDayId: string | null;
  shootDay?: { dayNumber: number; date: string | null };
  castLinks?: { castMember: { id: string; name: string; characterName: string } }[];
}

interface CastMember {
  id: string;
  name: string;
  characterName: string;
  dayRate: number;
}

interface ShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  scenes: { castLinks?: { castMember: { id: string; name: string } }[] }[];
}

export default function DOODPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: cast = [] } = useQuery<CastMember[]>({
    queryKey: ["cast", id],
    queryFn: () => fetch(`/api/projects/${id}/cast`).then((r) => r.json()),
  });

  const days: ShootDay[] = project?.shootDays || [];

  // Build Day-Out-Of-Days matrix
  const doodMatrix = useMemo(() => {
    if (cast.length === 0 || days.length === 0) return [];

    return cast.map((member) => {
      const dayStatuses = days.map((day) => {
        const isWorking = day.scenes.some((s) =>
          s.castLinks?.some((cl) => cl.castMember.id === member.id)
        );
        return { dayNumber: day.dayNumber, date: day.date, working: isWorking };
      });

      // Find first and last working day
      const workingDays = dayStatuses.filter((d) => d.working);
      const firstDay = workingDays[0]?.dayNumber || 0;
      const lastDay = workingDays[workingDays.length - 1]?.dayNumber || 0;
      const totalWorkDays = workingDays.length;

      // Mark hold days (between first and last work day, not working)
      const statuses = dayStatuses.map((d) => {
        if (d.working) return "W"; // Work
        if (d.dayNumber >= firstDay && d.dayNumber <= lastDay) return "H"; // Hold
        if (d.dayNumber === firstDay) return "SW"; // Start/Work
        if (d.dayNumber === lastDay) return "WF"; // Work/Finish
        return ""; // Not involved
      });

      return {
        member,
        statuses,
        totalWorkDays,
        totalHoldDays: statuses.filter((s) => s === "H").length,
        firstDay,
        lastDay,
      };
    });
  }, [cast, days]);

  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 h-12 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
            Day Out of Days
          </h1>
          <Badge variant="neutral">{cast.length} cast · {days.length} days</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode("grid")} className={`sf-tab ${viewMode === "grid" ? "active" : ""}`}>Grid</button>
          <button onClick={() => setViewMode("list")} className={`sf-tab ${viewMode === "list" ? "active" : ""}`}>List</button>
        </div>
      </div>

      {cast.length === 0 || days.length === 0 ? (
        <div className="sf-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" className="mb-5">
            <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="sf-empty-title">No DOOD data available</h3>
          <p className="sf-empty-desc">Add cast members and schedule scenes to generate the Day Out of Days report.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {viewMode === "grid" ? (
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="sf-table" style={{ fontSize: "var(--text-xs)" }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, background: "var(--bg-surface-1)", zIndex: 10, minWidth: 160 }}>
                        Cast Member
                      </th>
                      {days.map((d) => (
                        <th key={d.id} style={{ width: 40, textAlign: "center", padding: "4px 2px" }}>
                          <div>{d.dayNumber}</div>
                          {d.date && <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" })}</div>}
                        </th>
                      ))}
                      <th style={{ width: 50, textAlign: "center" }}>Work</th>
                      <th style={{ width: 50, textAlign: "center" }}>Hold</th>
                      <th style={{ width: 80, textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doodMatrix.map((row) => (
                      <tr key={row.member.id}>
                        <td style={{ position: "sticky", left: 0, background: "var(--bg-surface-1)", zIndex: 5 }}>
                          <div style={{ fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>{row.member.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{row.member.characterName}</div>
                        </td>
                        {row.statuses.map((status, i) => (
                          <td key={i} style={{ textAlign: "center", padding: "4px 2px" }}>
                            {status === "W" && (
                              <div className="w-6 h-6 rounded mx-auto flex items-center justify-center text-xs font-bold" style={{ background: "rgba(59,130,246,0.2)", color: "var(--blue-primary)" }}>W</div>
                            )}
                            {status === "H" && (
                              <div className="w-6 h-6 rounded mx-auto flex items-center justify-center text-xs" style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}>H</div>
                            )}
                            {status === "SW" && (
                              <div className="w-6 h-6 rounded mx-auto flex items-center justify-center text-xs font-bold" style={{ background: "rgba(34,197,94,0.2)", color: "var(--green)" }}>SW</div>
                            )}
                            {status === "WF" && (
                              <div className="w-6 h-6 rounded mx-auto flex items-center justify-center text-xs font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "var(--red)" }}>WF</div>
                            )}
                          </td>
                        ))}
                        <td className="cell-mono text-center">{row.totalWorkDays}</td>
                        <td className="cell-mono text-center">{row.totalHoldDays}</td>
                        <td className="cell-mono text-right">{formatCurrency(row.totalWorkDays * row.member.dayRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-4 px-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: "rgba(34,197,94,0.2)" }} />
                  <span>SW = Start/Work</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: "rgba(59,130,246,0.2)" }} />
                  <span>W = Work</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: "rgba(245,158,11,0.15)" }} />
                  <span>H = Hold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: "rgba(239,68,68,0.2)" }} />
                  <span>WF = Work/Finish</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 max-w-[700px] mx-auto">
              {doodMatrix.map((row) => (
                <div key={row.member.id} className="sf-card mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                        {row.member.name}
                      </h3>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{row.member.characterName}</p>
                    </div>
                    <Badge variant="neutral">{formatCurrency(row.totalWorkDays * row.member.dayRate)}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-mono-num" style={{ fontSize: "var(--text-lg)", color: "var(--blue-primary)" }}>{row.totalWorkDays}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Work Days</div>
                    </div>
                    <div>
                      <div className="text-mono-num" style={{ fontSize: "var(--text-lg)", color: "var(--amber)" }}>{row.totalHoldDays}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Hold Days</div>
                    </div>
                    <div>
                      <div className="text-mono-num" style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>{row.firstDay || "—"}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>First Day</div>
                    </div>
                    <div>
                      <div className="text-mono-num" style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>{row.lastDay || "—"}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Last Day</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
