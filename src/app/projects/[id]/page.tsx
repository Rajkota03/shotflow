"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenText,
  Boxes,
  CalendarRange,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { formatCompact } from "@/lib/utils";

/* ── Types ── */

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  pageCount: number;
  intExt: string;
  dayNight: string;
  elementsJson: string | null;
  shootDayId: string | null;
  status?: string;
}

interface ShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  callTime: string | null;
  estimatedWrap: string | null;
  dayType: string;
  isTravelDay: boolean;
  location?: { name: string } | null;
  scenes: Scene[];
}

interface ProjectData {
  id: string;
  title: string;
  genre: string | null;
  format: string;
  budgetCap: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  scenes: Scene[];         // unscheduled scenes (shootDayId: null)
  shootDays: ShootDay[];
  castMembers: { id: string }[];
  crewMembers: { id: string; dayRate: number }[];
  locations: { id: string }[];
  equipment: { id: string; dailyRental: number }[];
}

interface BudgetData {
  totalProjected: number;
  budgetCap: number;
}

/* ── Helpers ── */

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Component ── */

export default function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: project, isLoading } = useQuery<ProjectData>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: budgetData } = useQuery<BudgetData>({
    queryKey: ["budget", id],
    queryFn: () => fetch(`/api/projects/${id}/budget`).then((r) => r.json()),
    enabled: !!project,
  });

  const stats = useMemo(() => {
    if (!project) return null;

    // All scenes = scheduled (inside shootDays) + unscheduled (top-level scenes)
    const scheduledScenes = project.shootDays.flatMap((d) => d.scenes);
    const allScenes = [...scheduledScenes, ...project.scenes];
    const totalScenes = allScenes.length;
    const totalPages = allScenes.reduce((sum, s) => sum + s.pageCount, 0);
    const unscheduledCount = project.scenes.length;

    // Breakdown: scenes with non-empty elementsJson
    const brokenDownCount = allScenes.filter((s) => {
      try {
        const els = JSON.parse(s.elementsJson || "[]");
        return els.length > 0;
      } catch {
        return false;
      }
    }).length;

    const hasScript = totalScenes > 0;
    const hasBreakdown = brokenDownCount > 0;
    const hasSchedule = project.shootDays.length > 0;
    const isReady = hasScript && hasBreakdown && hasSchedule;

    // Next shoot day (future only, sorted by date)
    const now = new Date(new Date().toDateString());
    const nextShootDay = project.shootDays
      .filter((d) => d.date && new Date(d.date) >= now)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())[0] || null;

    return {
      totalScenes,
      totalPages,
      shootDayCount: project.shootDays.length,
      castCount: project.castMembers.length,
      unscheduledCount,
      brokenDownCount,
      hasScript,
      hasBreakdown,
      hasSchedule,
      isReady,
      nextShootDay,
    };
  }, [project]);

  if (isLoading || !project || !stats) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            border: "2px solid var(--border-strong)",
            borderTopColor: "var(--blue)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontFamily: "var(--font-ui)" }}>
            Loading dashboard...
          </span>
        </div>
      </div>
    );
  }

  const currency = project.currency || "INR";
  const totalBudget = budgetData?.totalProjected || 0;

  /* ── Pipeline steps ── */
  const pipeline = [
    { key: "script", label: "Script", done: stats.hasScript },
    { key: "breakdown", label: "Breakdown", done: stats.hasBreakdown },
    { key: "schedule", label: "Schedule", done: stats.hasSchedule },
    { key: "ready", label: "Ready to Shoot", done: stats.isReady },
  ];
  const completedSteps = pipeline.filter((s) => s.done).length;
  const progressPercent = Math.round((completedSteps / pipeline.length) * 100);

  /* ── Quick actions ── */
  const quickActions = [
    {
      href: `/projects/${id}/script`,
      icon: BookOpenText,
      title: "Upload Script",
      desc: "Import your screenplay and extract scene structure.",
    },
    {
      href: `/projects/${id}/breakdown`,
      icon: Sparkles,
      title: "AI Breakdown",
      desc: "Auto-extract cast, props, locations from every scene.",
    },
    {
      href: `/projects/${id}/schedule`,
      icon: CalendarRange,
      title: "Schedule",
      desc: "Build the shooting plan across days and locations.",
    },
    {
      href: `/projects/${id}/call-sheet`,
      icon: ClipboardCheck,
      title: "Call Sheet",
      desc: "Generate daily call sheets for cast and crew.",
    },
  ];

  /* ── Next shoot day info ── */
  const nextDay = stats.nextShootDay;
  const nextDaySceneCount = nextDay ? nextDay.scenes.length : 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: "var(--text-primary)",
            fontFamily: "var(--font-ui)", margin: 0, lineHeight: 1.2,
          }}>
            {project.title}
          </h1>
          {(project.format || project.genre) && (
            <span style={{
              fontSize: 12, color: "var(--text-tertiary)",
              fontFamily: "var(--font-ui)", textTransform: "capitalize",
            }}>
              {[project.format, project.genre].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Scenes", value: String(stats.totalScenes) },
            { label: "Pages", value: stats.totalPages.toFixed(0) },
            { label: "Shoot Days", value: String(stats.shootDayCount) },
            { label: "Cast", value: String(stats.castCount) },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 18, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-ui)", letterSpacing: "-0.01em",
              }}>
                {s.value}
              </span>
              <span style={{
                fontSize: 11, color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                fontFamily: "var(--font-ui)",
              }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pipeline Progress ── */}
      <div style={{
        background: "var(--bg-surface-2)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 24,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--text-tertiary)",
            fontFamily: "var(--font-ui)",
          }}>
            Pipeline Progress
          </span>
          <span style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontFamily: "var(--font-ui)",
          }}>
            {completedSteps} of {pipeline.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          width: "100%", height: 6, borderRadius: 3,
          background: "var(--bg-surface-4)",
          marginBottom: 18,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: "100%",
            borderRadius: 3,
            background: stats.isReady ? "var(--green)" : "var(--blue)",
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Step indicators */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {pipeline.map((step) => (
            <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {step.done ? (
                <CheckCircle2 size={16} style={{ color: "var(--green)", flexShrink: 0 }} />
              ) : (
                <Circle size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              )}
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: step.done ? "var(--green)" : "var(--text-tertiary)",
                fontFamily: "var(--font-ui)",
              }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Actions Grid (2x2) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 14,
        marginBottom: 24,
      }}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="dashboard-action-card"
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "20px 22px",
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "var(--bg-surface-4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={18} style={{ color: "var(--blue)" }} />
              </div>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                  fontFamily: "var(--font-ui)", marginBottom: 3,
                }}>
                  {action.title}
                </div>
                <div style={{
                  fontSize: 12, color: "var(--text-tertiary)",
                  fontFamily: "var(--font-ui)", lineHeight: 1.4,
                }}>
                  {action.desc}
                </div>
              </div>
              <ArrowRight size={14} style={{
                color: "var(--text-tertiary)", flexShrink: 0, marginTop: 2, marginLeft: "auto",
              }} />
            </Link>
          );
        })}
      </div>

      {/* ── At a Glance (3 columns) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
      }}>
        {/* Unscheduled Scenes */}
        <div style={{
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "22px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <FileText size={14} style={{ color: "var(--text-tertiary)" }} />
            <span style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-tertiary)",
              fontFamily: "var(--font-ui)",
            }}>
              Unscheduled Scenes
            </span>
          </div>
          <div style={{
            fontSize: 32, fontWeight: 700, color: stats.unscheduledCount > 0 ? "var(--amber)" : "var(--green)",
            fontFamily: "var(--font-ui)", lineHeight: 1, letterSpacing: "-0.02em",
          }}>
            {stats.unscheduledCount}
          </div>
          <div style={{
            fontSize: 12, color: "var(--text-tertiary)", marginTop: 6,
            fontFamily: "var(--font-ui)",
          }}>
            {stats.unscheduledCount > 0
              ? `${stats.unscheduledCount} scene${stats.unscheduledCount !== 1 ? "s" : ""} not yet placed on the board`
              : "All scenes are scheduled"}
          </div>
        </div>

        {/* Next Shoot Day */}
        <div style={{
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "22px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <CalendarRange size={14} style={{ color: "var(--text-tertiary)" }} />
            <span style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-tertiary)",
              fontFamily: "var(--font-ui)",
            }}>
              Next Shoot Day
            </span>
          </div>
          {nextDay && nextDay.date ? (
            <>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-ui)", lineHeight: 1.2,
              }}>
                {formatDateShort(nextDay.date)}
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-tertiary)", marginTop: 6,
                fontFamily: "var(--font-ui)",
              }}>
                Day {nextDay.dayNumber} · {nextDaySceneCount} scene{nextDaySceneCount !== 1 ? "s" : ""}
                {nextDay.location && ` · ${nextDay.location.name}`}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "var(--text-tertiary)",
                fontFamily: "var(--font-ui)", lineHeight: 1.2,
              }}>
                --
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-tertiary)", marginTop: 6,
                fontFamily: "var(--font-ui)",
              }}>
                No upcoming shoot days scheduled
              </div>
            </>
          )}
        </div>

        {/* Budget Status */}
        <div style={{
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "22px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <Wallet size={14} style={{ color: "var(--text-tertiary)" }} />
            <span style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-tertiary)",
              fontFamily: "var(--font-ui)",
            }}>
              Budget Status
            </span>
          </div>
          {totalBudget > 0 ? (
            <>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-ui)", lineHeight: 1.2,
              }}>
                {formatCompact(totalBudget, currency)}
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-tertiary)", marginTop: 6,
                fontFamily: "var(--font-ui)",
              }}>
                Estimated total
                {project.budgetCap > 0 && ` · Cap: ${formatCompact(project.budgetCap, currency)}`}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "var(--text-tertiary)",
                fontFamily: "var(--font-ui)", lineHeight: 1.2,
              }}>
                Not set
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-tertiary)", marginTop: 6,
                fontFamily: "var(--font-ui)",
              }}>
                Add crew or equipment rates to see projections
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dashboard-action-card:hover {
          border-color: var(--border-strong) !important;
          background: var(--bg-surface-3) !important;
        }
      `}</style>
    </div>
  );
}
