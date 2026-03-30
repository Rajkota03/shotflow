"use client";
import React, { use, useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import "./reports.css";

/* ── Types ─────────────────────────────────────────── */

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  elementsJson: string;
  content: string | null;
  castLinks: { castMember: { id: string; name: string; characterName: string | null; roleType: string } }[];
}

interface ShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  callTime: string | null;
  estimatedWrap: string | null;
  location: { name: string } | null;
  scenes: Scene[];
}

interface CastMember {
  id: string;
  name: string;
  characterName: string | null;
  roleType: string;
  dayRate: number;
  sceneLinks: { scene: { id: string; sceneNumber: string } }[];
}

interface ProjectData {
  id: string;
  title: string;
  currency: string;
  budgetCap: number;
  shootDays: ShootDay[];
  scenes: Scene[];
  castMembers: CastMember[];
  crewMembers: { id: string; name: string; role: string; department: string; dayRate: number }[];
  locations: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string; dailyRental: number }[];
}

type ReportType =
  | "dood"
  | "cast-report"
  | "call-sheet"
  | "scene-breakdown"
  | "budget-top-sheet"
  | "one-liner"
  | "progress"
  | "custom";

interface ReportDef {
  key: ReportType;
  label: string;
  desc: string;
  icon: string;
}

const REPORTS: ReportDef[] = [
  { key: "dood", label: "Day Out of Days", desc: "Which cast works which days", icon: "📊" },
  { key: "cast-report", label: "Cast Scene Report", desc: "Scenes per character — schedule & total", icon: "🎭" },
  { key: "call-sheet", label: "Call Sheet", desc: "Daily call for cast & crew", icon: "📋" },
  { key: "scene-breakdown", label: "Scene Breakdown", desc: "Elements per scene", icon: "🎬" },
  { key: "budget-top-sheet", label: "Budget Top Sheet", desc: "Budget summary by department", icon: "💰" },
  { key: "one-liner", label: "One-Liner Schedule", desc: "Compact shooting schedule", icon: "📄" },
  { key: "progress", label: "Production Progress", desc: "Pages shot, scenes completed", icon: "📈" },
  { key: "custom", label: "Custom Report", desc: "Build your own report", icon: "🛠" },
];

const CUSTOM_ELEMENTS = [
  { key: "scenes", label: "Scene List" },
  { key: "cast", label: "Cast / Characters" },
  { key: "locations", label: "Locations" },
  { key: "equipment", label: "Equipment" },
  { key: "crew", label: "Crew" },
  { key: "budget", label: "Budget Summary" },
  { key: "schedule", label: "Schedule Overview" },
  { key: "props", label: "Props List" },
  { key: "wardrobe", label: "Wardrobe" },
  { key: "vehicles", label: "Vehicles" },
  { key: "vfx", label: "VFX Shots" },
] as const;

/* ── Helpers ──────────────────────────────────────── */

function fmtDate(d: string | null) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function parseElements(json: string): { category: string; name: string }[] {
  try {
    return JSON.parse(json || "[]");
  } catch {
    return [];
  }
}

/* ── Page ─────────────────────────────────────────── */

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [customElements, setCustomElements] = useState<Set<string>>(new Set(["scenes", "cast"]));
  const printRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading } = useQuery<ProjectData>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: cast = [] } = useQuery<CastMember[]>({
    queryKey: ["cast", id],
    queryFn: () => fetch(`/api/projects/${id}/cast`).then((r) => r.json()),
  });

  const { data: budgetData } = useQuery({
    queryKey: ["budget", id],
    queryFn: () => fetch(`/api/projects/${id}/budget`).then((r) => r.json()),
    enabled: !!project,
  });

  const currency = project?.currency || "INR";
  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency]);

  const allScenes = useMemo(() => {
    if (!project) return [];
    const scheduled = project.shootDays.flatMap((d) => d.scenes);
    return [...scheduled, ...project.scenes];
  }, [project]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${project?.title || "Report"}</title>
      <style>
        body { font-family: -apple-system, sans-serif; color: #111; padding: 24px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: left; }
        th { font-weight: 600; font-size: 10px; text-transform: uppercase; color: #666; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 14px; margin: 16px 0 8px; }
        .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [project]);

  if (isLoading || !project) {
    return (
      <div className="rpt-loading">
        <div className="rpt-loading__spinner" />
      </div>
    );
  }

  /* ── Report Renderers ───────────────────────── */

  function renderDOOD() {
    const days = project!.shootDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (days.length === 0 || cast.length === 0) {
      return <EmptyState text="Need scheduled scenes and cast to generate DOOD" />;
    }

    const castDayMap = new Map<string, Set<number>>();
    for (const c of cast) castDayMap.set(c.id, new Set());

    for (const day of days) {
      for (const scene of day.scenes) {
        for (const link of (scene.castLinks || [])) {
          castDayMap.get(link.castMember.id)?.add(day.dayNumber);
        }
      }
    }

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">Day Out of Days · {cast.length} cast · {days.length} shoot days</div>

        <div className="rpt-scroll-x">
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="rpt-table__sticky-col" style={{ minWidth: 160 }}>Character</th>
                <th style={{ width: 50 }}>Role</th>
                {days.map((d) => (
                  <th key={d.id} style={{ textAlign: "center", minWidth: 32, fontSize: 9 }}>
                    D{d.dayNumber}
                    <br />
                    <span className="rpt-table__sub">{d.date ? new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>
                  </th>
                ))}
                <th style={{ textAlign: "center" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cast.map((member) => {
                const memberDays = castDayMap.get(member.id) || new Set();
                return (
                  <tr key={member.id}>
                    <td className="rpt-table__sticky-col rpt-table__name">
                      {member.characterName || "Unknown"}
                      {member.name && <span className="rpt-table__sub-inline"> ({member.name})</span>}
                    </td>
                    <td>
                      <span className={`rpt-role-badge rpt-role-badge--${member.roleType}`}>
                        {member.roleType === "day_player" ? "DP" : member.roleType.charAt(0).toUpperCase()}
                      </span>
                    </td>
                    {days.map((d) => (
                      <td key={d.id} style={{ textAlign: "center" }}>
                        {memberDays.has(d.dayNumber) ? (
                          <span className="rpt-work-badge">W</span>
                        ) : (
                          <span className="rpt-table__dot">·</span>
                        )}
                      </td>
                    ))}
                    <td className="rpt-table__mono" style={{ textAlign: "center", fontWeight: 600 }}>{memberDays.size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCastReport() {
    if (cast.length === 0) {
      return <EmptyState text="No cast members added yet" />;
    }

    const days = project!.shootDays.sort((a, b) => a.dayNumber - b.dayNumber);

    // Build per-cast data: total scenes (from sceneLinks) + scheduled scenes per day
    const castData = cast.map((member) => {
      const totalSceneIds = new Set(member.sceneLinks.map((l) => l.scene.id));
      const totalSceneNumbers = member.sceneLinks.map((l) => l.scene.sceneNumber).sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
      });

      // Scenes in the schedule (from shootDays)
      const scheduledScenes: { dayNumber: number; date: string | null; sceneNumber: string; sceneName: string; intExt: string; dayNight: string }[] = [];
      for (const day of days) {
        for (const scene of day.scenes) {
          const isLinked = scene.castLinks?.some((l) => l.castMember.id === member.id);
          if (isLinked) {
            scheduledScenes.push({
              dayNumber: day.dayNumber,
              date: day.date,
              sceneNumber: scene.sceneNumber,
              sceneName: scene.sceneName,
              intExt: scene.intExt,
              dayNight: scene.dayNight,
            });
          }
        }
      }

      const scheduledDays = new Set(scheduledScenes.map((s) => s.dayNumber));

      return {
        id: member.id,
        name: member.name,
        characterName: member.characterName,
        roleType: member.roleType,
        totalSceneCount: totalSceneIds.size,
        totalSceneNumbers,
        scheduledScenes,
        scheduledDayCount: scheduledDays.size,
      };
    }).sort((a, b) => b.totalSceneCount - a.totalSceneCount);

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">Cast Scene Report · {cast.length} cast members · {days.length} shoot days</div>

        {castData.map((cm) => (
          <div key={cm.id} className="rpt-cast-block">
            <div className="rpt-cast-block__header">
              <div className="rpt-cast-block__name">
                {cm.characterName || cm.name}
                {cm.characterName && cm.name && <span className="rpt-table__sub-inline"> ({cm.name})</span>}
              </div>
              <span className={`rpt-role-badge rpt-role-badge--${cm.roleType}`}>
                {cm.roleType.replace("_", " ")}
              </span>
            </div>

            <div className="rpt-cast-block__stats">
              <div className="rpt-stat-pill">
                <span className="rpt-stat-pill__value">{cm.totalSceneCount}</span>
                <span className="rpt-stat-pill__label">Total Scenes</span>
              </div>
              <div className="rpt-stat-pill">
                <span className="rpt-stat-pill__value">{cm.scheduledScenes.length}</span>
                <span className="rpt-stat-pill__label">Scheduled</span>
              </div>
              <div className="rpt-stat-pill">
                <span className="rpt-stat-pill__value">{cm.scheduledDayCount}</span>
                <span className="rpt-stat-pill__label">Shoot Days</span>
              </div>
            </div>

            {/* All scenes */}
            <div className="rpt-cast-block__section">
              <div className="rpt-cast-block__section-label">All Scenes</div>
              <div className="rpt-scene-pills">
                {cm.totalSceneNumbers.map((sn) => (
                  <span key={sn} className="rpt-scene-pill">{sn}</span>
                ))}
                {cm.totalSceneNumbers.length === 0 && <span className="rpt-table__sub-inline">None linked</span>}
              </div>
            </div>

            {/* Schedule breakdown */}
            {cm.scheduledScenes.length > 0 && (
              <div className="rpt-cast-block__section">
                <div className="rpt-cast-block__section-label">Schedule</div>
                <table className="rpt-table rpt-table--compact">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Date</th>
                      <th>Sc#</th>
                      <th>Scene</th>
                      <th>I/E</th>
                      <th>D/N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cm.scheduledScenes.map((s, i) => (
                      <tr key={i}>
                        <td className="rpt-table__mono">{s.dayNumber}</td>
                        <td>{fmtDate(s.date)}</td>
                        <td className="rpt-table__mono">{s.sceneNumber}</td>
                        <td>{s.sceneName}</td>
                        <td>{s.intExt}</td>
                        <td>{s.dayNight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderCallSheet() {
    const days = project!.shootDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (days.length === 0) return <EmptyState text="No shoot days to generate call sheets" />;

    const day = selectedDay ? days.find((d) => d.id === selectedDay) : days[0];
    if (!day) return <EmptyState text="Select a shoot day" />;

    const dayCast = new Map<string, { name: string; characterName: string | null; roleType: string }>();
    for (const scene of day.scenes) {
      for (const link of (scene.castLinks || [])) {
        dayCast.set(link.castMember.id, link.castMember);
      }
    }

    return (
      <div>
        <div className="rpt-day-selector">
          {days.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`rpt-day-btn ${(selectedDay === d.id || (!selectedDay && d === days[0])) ? "rpt-day-btn--active" : ""}`}
            >
              Day {d.dayNumber}
            </button>
          ))}
        </div>

        <h1 className="rpt-title">CALL SHEET — Day {day.dayNumber}</h1>
        <div className="rpt-meta">
          {project!.title} · {fmtDate(day.date)} · Call: {day.callTime || "TBD"} · Wrap: {day.estimatedWrap || "TBD"}
          {day.location && ` · ${day.location.name}`}
        </div>

        <h2 className="rpt-section-title">Scenes</h2>
        <table className="rpt-table">
          <thead>
            <tr>
              <th>SC#</th>
              <th>I/E</th>
              <th>Location</th>
              <th>D/N</th>
              <th style={{ textAlign: "right" }}>Pages</th>
            </tr>
          </thead>
          <tbody>
            {day.scenes.map((s) => (
              <tr key={s.id}>
                <td className="rpt-table__mono">{s.sceneNumber}</td>
                <td>{s.intExt}</td>
                <td>{s.sceneName}</td>
                <td>{s.dayNight}</td>
                <td className="rpt-table__mono" style={{ textAlign: "right" }}>{s.pageCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="rpt-section-title">Cast</h2>
        <table className="rpt-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Character</th>
              <th>Actor</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(dayCast.entries()).map(([cid, cm], i) => (
              <tr key={cid}>
                <td className="rpt-table__mono">{i + 1}</td>
                <td className="rpt-table__name">{cm.characterName || "—"}</td>
                <td>{cm.name || "TBD"}</td>
                <td style={{ textTransform: "capitalize" }}>{cm.roleType.replace("_", " ")}</td>
              </tr>
            ))}
            {dayCast.size === 0 && (
              <tr><td colSpan={4} className="rpt-table__empty">No cast linked to scenes on this day</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSceneBreakdown() {
    if (allScenes.length === 0) return <EmptyState text="Import a script first to see scene breakdowns" />;

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">Scene Breakdown Report · {allScenes.length} scenes</div>

        {allScenes.map((scene) => {
          const elements = parseElements(scene.elementsJson);
          const grouped = elements.reduce((acc, el) => {
            if (!acc[el.category]) acc[el.category] = [];
            acc[el.category].push(el.name);
            return acc;
          }, {} as Record<string, string[]>);

          return (
            <div key={scene.id} className="rpt-breakdown-item">
              <div className="rpt-breakdown-item__header">
                <span className="rpt-table__mono" style={{ fontWeight: 700 }}>Sc {scene.sceneNumber}</span>
                <span className="rpt-table__sub-inline">{scene.intExt}. {scene.sceneName} — {scene.dayNight}</span>
                <span className="rpt-table__sub-inline" style={{ marginLeft: "auto" }}>{scene.pageCount} pg</span>
              </div>
              {Object.keys(grouped).length > 0 ? (
                <div className="rpt-breakdown-item__elements">
                  {Object.entries(grouped).map(([cat, names]) => (
                    <div key={cat}>
                      <span className="rpt-breakdown-item__cat">{cat}: </span>
                      <span>{names.join(", ")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="rpt-table__sub-inline" style={{ fontStyle: "italic" }}>No breakdown elements yet</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderBudgetTopSheet() {
    if (!budgetData) return <EmptyState text="Loading budget data..." />;

    const departments = budgetData.departments || [];
    const total = budgetData.totalProjected || 0;

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">
          Budget Top Sheet · {project!.shootDays.length} shoot days · Cap: {project!.budgetCap > 0 ? fmt(project!.budgetCap) : "Not set"}
        </div>

        <table className="rpt-table">
          <thead>
            <tr>
              <th>Department</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept: { name: string; amount: number; color: string }) => (
              <tr key={dept.name}>
                <td>
                  <span className="rpt-dept-dot" style={{ background: dept.color }} />
                  {dept.name}
                </td>
                <td className="rpt-table__mono" style={{ textAlign: "right" }}>{fmt(dept.amount)}</td>
                <td className="rpt-table__mono rpt-table__sub-inline" style={{ textAlign: "right" }}>
                  {total > 0 ? ((dept.amount / total) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="rpt-table__total-row">
              <td>TOTAL PROJECTED</td>
              <td className="rpt-table__mono" style={{ textAlign: "right" }}>{fmt(total)}</td>
              <td className="rpt-table__mono" style={{ textAlign: "right" }}>100%</td>
            </tr>
            {project!.budgetCap > 0 && (
              <tr>
                <td className="rpt-table__sub-inline">Variance</td>
                <td className="rpt-table__mono" style={{ textAlign: "right", color: total > project!.budgetCap ? "var(--red)" : "var(--green)" }}>
                  {total > project!.budgetCap ? "-" : "+"}{fmt(Math.abs(project!.budgetCap - total))}
                </td>
                <td />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    );
  }

  function renderOneLiner() {
    const days = project!.shootDays.sort((a, b) => a.dayNumber - b.dayNumber);
    if (days.length === 0) return <EmptyState text="No shoot days to generate one-liner" />;

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">One-Liner Schedule · {days.length} shoot days</div>

        <table className="rpt-table">
          <thead>
            <tr>
              <th>SC#</th>
              <th>I/E</th>
              <th>Location</th>
              <th>D/N</th>
              <th>Cast</th>
              <th style={{ textAlign: "right" }}>PP</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <React.Fragment key={day.id}>
                <tr className="rpt-table__day-header">
                  <td colSpan={6}>
                    Day {day.dayNumber} {day.date && ` — ${fmtDate(day.date)}`}
                    {day.location && <span className="rpt-table__sub-inline"> · {day.location.name}</span>}
                  </td>
                </tr>
                {day.scenes.map((s) => (
                  <tr key={s.id}>
                    <td className="rpt-table__mono">{s.sceneNumber}</td>
                    <td>{s.intExt}</td>
                    <td>{s.sceneName}</td>
                    <td>{s.dayNight}</td>
                    <td style={{ fontSize: 10 }}>
                      {(s.castLinks || []).map((cl) => cl.castMember.characterName || cl.castMember.name).join(", ") || "—"}
                    </td>
                    <td className="rpt-table__mono" style={{ textAlign: "right" }}>{s.pageCount}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderProgress() {
    const days = project!.shootDays.sort((a, b) => a.dayNumber - b.dayNumber);
    const totalScenes = allScenes.length;
    const scheduledScenes = project!.shootDays.flatMap((d) => d.scenes).length;
    const totalPages = allScenes.reduce((s, sc) => s + sc.pageCount, 0);
    const scheduledPages = project!.shootDays.flatMap((d) => d.scenes).reduce((s, sc) => s + sc.pageCount, 0);

    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">Production Progress Report</div>

        <div className="rpt-stat-grid">
          {[
            { label: "Total Scenes", value: totalScenes },
            { label: "Scheduled", value: scheduledScenes },
            { label: "Total Pages", value: totalPages.toFixed(1) },
            { label: "Pages Scheduled", value: scheduledPages.toFixed(1) },
          ].map((s) => (
            <div key={s.label} className="rpt-stat-card">
              <div className="rpt-stat-card__value">{s.value}</div>
              <div className="rpt-stat-card__label">{s.label}</div>
            </div>
          ))}
        </div>

        <h2 className="rpt-section-title">Pages Per Day</h2>
        <table className="rpt-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th style={{ textAlign: "center" }}>Scenes</th>
              <th style={{ textAlign: "right" }}>Pages</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const dayPages = d.scenes.reduce((s, sc) => s + sc.pageCount, 0);
              return (
                <tr key={d.id}>
                  <td className="rpt-table__name">Day {d.dayNumber}</td>
                  <td className="rpt-table__sub-inline">{fmtDate(d.date)}</td>
                  <td style={{ textAlign: "center" }}>{d.scenes.length}</td>
                  <td className="rpt-table__mono" style={{ textAlign: "right" }}>{dayPages.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCustomReport() {
    return (
      <div>
        <h1 className="rpt-title">{project!.title}</h1>
        <div className="rpt-meta">Custom Report</div>

        <div className="rpt-custom-picker">
          {CUSTOM_ELEMENTS.map((el) => (
            <button
              key={el.key}
              onClick={() => {
                setCustomElements((prev) => {
                  const next = new Set(prev);
                  if (next.has(el.key)) next.delete(el.key);
                  else next.add(el.key);
                  return next;
                });
              }}
              className={`rpt-day-btn ${customElements.has(el.key) ? "rpt-day-btn--active" : ""}`}
            >
              {el.label}
            </button>
          ))}
        </div>

        {customElements.has("scenes") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Scenes ({allScenes.length})</h2>
            <table className="rpt-table">
              <tbody>
                {allScenes.map((s) => (
                  <tr key={s.id}>
                    <td className="rpt-table__mono" style={{ width: 50 }}>{s.sceneNumber}</td>
                    <td style={{ width: 40 }}>{s.intExt}</td>
                    <td>{s.sceneName}</td>
                    <td style={{ width: 50 }}>{s.dayNight}</td>
                    <td className="rpt-table__mono" style={{ textAlign: "right", width: 40 }}>{s.pageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {customElements.has("cast") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Cast ({cast.length})</h2>
            <table className="rpt-table">
              <tbody>
                {cast.map((c) => (
                  <tr key={c.id}>
                    <td className="rpt-table__name">{c.characterName || "Unknown"}</td>
                    <td>{c.name || "TBD"}</td>
                    <td style={{ textTransform: "capitalize" }}>{c.roleType.replace("_", " ")}</td>
                    <td className="rpt-table__mono" style={{ textAlign: "right" }}>{c.dayRate > 0 ? fmt(c.dayRate) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{c.sceneLinks.length} sc</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {customElements.has("locations") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Locations ({project!.locations.length})</h2>
            {project!.locations.length > 0 ? (
              <ul className="rpt-list">
                {project!.locations.map((l) => <li key={l.id}>{l.name}</li>)}
              </ul>
            ) : <span className="rpt-table__sub-inline">No locations added</span>}
          </section>
        )}

        {customElements.has("equipment") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Equipment ({project!.equipment.length})</h2>
            {project!.equipment.length > 0 ? (
              <table className="rpt-table">
                <tbody>
                  {project!.equipment.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td style={{ textTransform: "capitalize" }}>{e.category}</td>
                      <td className="rpt-table__mono" style={{ textAlign: "right" }}>{fmt(e.dailyRental)}/day</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <span className="rpt-table__sub-inline">No equipment added</span>}
          </section>
        )}

        {customElements.has("crew") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Crew ({project!.crewMembers.length})</h2>
            {project!.crewMembers.length > 0 ? (
              <table className="rpt-table">
                <tbody>
                  {project!.crewMembers.map((c) => (
                    <tr key={c.id}>
                      <td className="rpt-table__name">{c.name}</td>
                      <td>{c.role}</td>
                      <td style={{ textTransform: "capitalize" }}>{c.department}</td>
                      <td className="rpt-table__mono" style={{ textAlign: "right" }}>{fmt(c.dayRate)}/day</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <span className="rpt-table__sub-inline">No crew added</span>}
          </section>
        )}

        {customElements.has("budget") && budgetData && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Budget Summary</h2>
            <div style={{ fontSize: 12 }}>
              <div>Total Projected: <strong>{fmt(budgetData.totalProjected || 0)}</strong></div>
              {project!.budgetCap > 0 && <div>Budget Cap: <strong>{fmt(project!.budgetCap)}</strong></div>}
            </div>
          </section>
        )}

        {customElements.has("schedule") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Schedule Overview</h2>
            <div style={{ fontSize: 12 }}>
              <div>{project!.shootDays.length} shoot days</div>
              {project!.shootDays[0]?.date && <div>Starts: {fmtDate(project!.shootDays[0].date)}</div>}
              {project!.shootDays.length > 0 && project!.shootDays[project!.shootDays.length - 1]?.date && (
                <div>Ends: {fmtDate(project!.shootDays[project!.shootDays.length - 1].date)}</div>
              )}
            </div>
          </section>
        )}

        {customElements.has("props") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Props</h2>
            {renderElementsByCategory("props")}
          </section>
        )}

        {customElements.has("wardrobe") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Wardrobe</h2>
            {renderElementsByCategory("wardrobe")}
          </section>
        )}

        {customElements.has("vehicles") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">Vehicles</h2>
            {renderElementsByCategory("vehicles")}
          </section>
        )}

        {customElements.has("vfx") && (
          <section className="rpt-custom-section">
            <h2 className="rpt-section-title">VFX Shots</h2>
            {renderElementsByCategory("vfx")}
          </section>
        )}
      </div>
    );
  }

  function renderElementsByCategory(category: string) {
    const items: { sceneNumber: string; name: string }[] = [];
    for (const scene of allScenes) {
      const els = parseElements(scene.elementsJson);
      for (const el of els) {
        if (el.category.toLowerCase() === category.toLowerCase()) {
          items.push({ sceneNumber: scene.sceneNumber, name: el.name });
        }
      }
    }
    if (items.length === 0) return <span className="rpt-table__sub-inline">None found in breakdown</span>;

    const grouped = new Map<string, string[]>();
    for (const item of items) {
      if (!grouped.has(item.name)) grouped.set(item.name, []);
      grouped.get(item.name)!.push(item.sceneNumber);
    }

    return (
      <table className="rpt-table">
        <tbody>
          {Array.from(grouped.entries()).map(([name, scenes]) => (
            <tr key={name}>
              <td className="rpt-table__name">{name}</td>
              <td className="rpt-table__sub-inline">Sc {scenes.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const reportRenderers: Record<ReportType, () => React.ReactNode> = {
    dood: renderDOOD,
    "cast-report": renderCastReport,
    "call-sheet": renderCallSheet,
    "scene-breakdown": renderSceneBreakdown,
    "budget-top-sheet": renderBudgetTopSheet,
    "one-liner": renderOneLiner,
    progress: renderProgress,
    custom: renderCustomReport,
  };

  return (
    <div className="rpt-page">
      <div className="rpt-page__header">
        <div>
          <h2 className="rpt-page__title">Reports</h2>
          <p className="rpt-page__subtitle">
            Production reports, call sheets, and custom report builder
          </p>
        </div>
        {activeReport && (
          <button onClick={handlePrint} className="rpt-print-btn">
            Print / PDF
          </button>
        )}
      </div>

      {!activeReport ? (
        <div className="rpt-grid">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              className="rpt-card"
            >
              <div className="rpt-card__icon">{r.icon}</div>
              <div className="rpt-card__label">{r.label}</div>
              <div className="rpt-card__desc">{r.desc}</div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => { setActiveReport(null); setSelectedDay(null); }}
            className="rpt-back-btn"
          >
            ← All Reports
          </button>

          <div ref={printRef} className="rpt-content">
            {reportRenderers[activeReport]()}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rpt-empty">
      <p>{text}</p>
    </div>
  );
}
