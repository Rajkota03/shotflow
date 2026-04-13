"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  ScheduleBoardState,
  ScheduleProject,
  ScheduleShootDay,
} from "@/components/schedule/types";

type CategoryKey =
  | "location"
  | "permits"
  | "equipment"
  | "crew"
  | "cast"
  | "travel"
  | "lodging"
  | "catering";

const CATEGORIES: { key: CategoryKey; label: string; tone: string }[] = [
  { key: "location", label: "Location", tone: "#7dd3fc" },
  { key: "permits", label: "Permits", tone: "#fbbf24" },
  { key: "equipment", label: "Equipment", tone: "#a78bfa" },
  { key: "crew", label: "Crew", tone: "#f472b6" },
  { key: "cast", label: "Cast", tone: "#34d399" },
  { key: "travel", label: "Travel", tone: "#fb923c" },
  { key: "lodging", label: "Lodging", tone: "#94a3b8" },
  { key: "catering", label: "Catering", tone: "#facc15" },
];

const STORAGE_KEY = "shotflow.budgetBar.v1";

interface Prefs {
  enabled: Record<CategoryKey, boolean>;
  collapsed: boolean;
}

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      enabled: { ...defaultPrefs().enabled, ...(parsed.enabled || {}) },
      collapsed: !!parsed.collapsed,
    };
  } catch {
    return defaultPrefs();
  }
}

function defaultPrefs(): Prefs {
  return {
    enabled: CATEGORIES.reduce((acc, c) => {
      acc[c.key] = true;
      return acc;
    }, {} as Record<CategoryKey, boolean>),
    collapsed: false,
  };
}

function fmt(n: number, symbol: string): string {
  if (n === 0) return `${symbol}0`;
  if (n >= 10_000_000) return `${symbol}${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${symbol}${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(n)}`;
}

interface BudgetBarProps {
  days: ScheduleShootDay[];
  board: ScheduleBoardState;
  project: ScheduleProject;
  onCellClick?: (dayId: string) => void;
}

export function BudgetBar({ days, board, project, onCellClick }: BudgetBarProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => defaultPrefs());
  const cellsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  // Sync horizontal scroll with the schedule grid above
  useEffect(() => {
    const cells = cellsRef.current;
    if (!cells) return;
    const grid = document.querySelector<HTMLDivElement>(".schedule-grid");
    if (!grid) return;

    let lock = false;
    const onGridScroll = () => {
      if (lock) return;
      lock = true;
      cells.scrollLeft = grid.scrollLeft;
      requestAnimationFrame(() => { lock = false; });
    };
    const onCellsScroll = () => {
      if (lock) return;
      lock = true;
      grid.scrollLeft = cells.scrollLeft;
      requestAnimationFrame(() => { lock = false; });
    };

    grid.addEventListener("scroll", onGridScroll, { passive: true });
    cells.addEventListener("scroll", onCellsScroll, { passive: true });
    // Align initially
    cells.scrollLeft = grid.scrollLeft;
    return () => {
      grid.removeEventListener("scroll", onGridScroll);
      cells.removeEventListener("scroll", onCellsScroll);
    };
  }, [days.length, prefs.collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const symbol = project.currency === "INR" ? "₹" : "$";
  const cap = project.budgetCap || 0;

  // Permits applied only on first day a location appears
  const locationFirstDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of days) {
      const lid = day.location?.id;
      if (lid && !map.has(lid)) map.set(lid, day.id);
    }
    return map;
  }, [days]);

  // Per-day crew (everyone with paymentMode = per_day)
  const perDayCrewTotal = useMemo(() => {
    return (project.crewMembers || [])
      .filter((c) => c.paymentMode === "per_day")
      .reduce((s, c) => s + (c.dayRate || 0), 0);
  }, [project.crewMembers]);

  // Fixed (package) costs sit aside the per-day bar
  const fixedTotal = useMemo(() => {
    const crew = (project.crewMembers || [])
      .filter((c) => c.paymentMode === "package")
      .reduce((s, c) => s + (c.packageFee || 0), 0);
    const cast = (project.castMembers || [])
      .filter((c) => c.paymentMode === "package")
      .reduce((s, c) => s + (c.packageFee || 0), 0);
    return crew + cast;
  }, [project.crewMembers, project.castMembers]);

  function dayBreakdown(day: ScheduleShootDay): Record<CategoryKey, number> {
    const dayScenes = board[day.id] || [];
    const loc = day.location?.dailyRentalCost || 0;
    const permits =
      day.location?.id && locationFirstDay.get(day.location.id) === day.id
        ? day.location?.permitCost || 0
        : 0;
    const equipment = (day.equipmentLinks || []).reduce(
      (s, l) => s + (l.equipment?.dailyRental || 0) * (l.quantity || 1),
      0,
    );
    const seenCast = new Set<string>();
    let castSum = 0;
    for (const sc of dayScenes) {
      for (const link of sc.castLinks || []) {
        const cm = link.castMember;
        if (!cm) continue;
        if (cm.paymentMode === "package") continue;
        const key = cm.id || cm.name;
        if (seenCast.has(key)) continue;
        seenCast.add(key);
        castSum += cm.dayRate || 0;
      }
    }
    return {
      location: loc,
      permits,
      equipment,
      crew: dayScenes.length > 0 ? perDayCrewTotal : 0,
      cast: castSum,
      travel: day.travelCost || 0,
      lodging: day.lodgingCost || 0,
      catering: day.cateringCost || 0,
    };
  }

  function dayTotal(day: ScheduleShootDay): number {
    const b = dayBreakdown(day);
    let sum = 0;
    for (const c of CATEGORIES) {
      if (prefs.enabled[c.key]) sum += b[c.key];
    }
    return sum;
  }

  const grandDayOf = useMemo(
    () => days.reduce((s, d) => s + dayTotal(d), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, board, prefs, perDayCrewTotal, locationFirstDay],
  );
  const grandTotal = grandDayOf + fixedTotal;
  const overCap = cap > 0 && grandTotal > cap;
  const remaining = cap > 0 ? cap - grandTotal : 0;

  const toggle = (key: CategoryKey) => {
    setPrefs((p) => ({ ...p, enabled: { ...p.enabled, [key]: !p.enabled[key] } }));
  };

  if (prefs.collapsed) {
    return (
      <div className="budget-bar budget-bar--collapsed">
        <button
          type="button"
          className="budget-bar__expand"
          onClick={() => setPrefs((p) => ({ ...p, collapsed: false }))}
        >
          <ChevronUp size={12} />
          <span className="budget-bar__expand-label">Budget</span>
          <span className="budget-bar__expand-total">
            Day-of {fmt(grandDayOf, symbol)}
            {fixedTotal > 0 && <span className="budget-bar__expand-fixed"> + Fixed {fmt(fixedTotal, symbol)}</span>}
            <span className="budget-bar__expand-grand"> = {fmt(grandTotal, symbol)}</span>
          </span>
          {cap > 0 && (
            <span className={`budget-bar__expand-cap ${overCap ? "is-over" : ""}`}>
              {overCap ? `Over by ${fmt(grandTotal - cap, symbol)}` : `${fmt(remaining, symbol)} left`}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="budget-bar">
      {/* Header row: collapse + chips + grand totals */}
      <div className="budget-bar__header">
        <button
          type="button"
          className="budget-bar__collapse"
          onClick={() => setPrefs((p) => ({ ...p, collapsed: true }))}
          title="Collapse budget bar"
        >
          <ChevronDown size={12} />
          <span>Budget</span>
        </button>
        <div className="budget-bar__chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`budget-bar__chip ${prefs.enabled[c.key] ? "is-on" : ""}`}
              onClick={() => toggle(c.key)}
              style={prefs.enabled[c.key] ? { color: c.tone, borderColor: `${c.tone}55` } : undefined}
            >
              <span className="budget-bar__chip-dot" style={{ background: prefs.enabled[c.key] ? c.tone : "transparent", borderColor: c.tone }} />
              {c.label}
            </button>
          ))}
        </div>
        <div className="budget-bar__totals">
          <span className="budget-bar__total-block">
            <span className="budget-bar__total-label">Day-of</span>
            <span className="budget-bar__total-value">{fmt(grandDayOf, symbol)}</span>
          </span>
          {fixedTotal > 0 && (
            <span className="budget-bar__total-block">
              <span className="budget-bar__total-label">Fixed</span>
              <span className="budget-bar__total-value">{fmt(fixedTotal, symbol)}</span>
            </span>
          )}
          <span className="budget-bar__total-block budget-bar__total-block--grand">
            <span className="budget-bar__total-label">Total</span>
            <span className={`budget-bar__total-value ${overCap ? "is-over" : ""}`}>{fmt(grandTotal, symbol)}</span>
          </span>
          {cap > 0 && (
            <span className={`budget-bar__cap ${overCap ? "is-over" : ""}`}>
              {overCap ? `Over by ${fmt(grandTotal - cap, symbol)}` : `${fmt(remaining, symbol)} left of ${fmt(cap, symbol)}`}
            </span>
          )}
        </div>
      </div>

      {/* Per-day cells — aligned to day columns */}
      <div className="budget-bar__cells" ref={cellsRef}>
        {days.map((day) => {
          const b = dayBreakdown(day);
          const total = dayTotal(day);
          const enabledList = CATEGORIES.filter((c) => prefs.enabled[c.key] && b[c.key] > 0);
          const isEmpty = total === 0;
          const title = isEmpty
            ? "No costs entered — click to open Day Review and add location/travel/lodging/catering"
            : enabledList.map((c) => `${c.label}: ${fmt(b[c.key], symbol)}`).join(" · ");
          return (
            <button
              key={day.id}
              type="button"
              className={`budget-bar__cell ${isEmpty ? "budget-bar__cell--empty" : ""}`}
              title={title}
              onClick={() => onCellClick?.(day.id)}
            >
              <div className="budget-bar__cell-day">D{day.dayNumber}</div>
              <div className="budget-bar__cell-total">
                {isEmpty ? <span className="budget-bar__cell-hint">Add costs</span> : fmt(total, symbol)}
              </div>
              <div className="budget-bar__cell-stack">
                {enabledList.slice(0, 4).map((c) => (
                  <div
                    key={c.key}
                    className="budget-bar__cell-bar"
                    style={{
                      width: `${total > 0 ? (b[c.key] / total) * 100 : 0}%`,
                      background: c.tone,
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
