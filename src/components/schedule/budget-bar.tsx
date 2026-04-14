"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  ScheduleBoardState,
  ScheduleProject,
  ScheduleShootDay,
} from "@/components/schedule/types";

/* ── Budget Planning line-item shape (mirrors budget/page.tsx) ── */
type RateType = "daily" | "weekly" | "flat";
interface BudgetLineItem {
  id: string;
  name: string;
  rate: number;
  quantity: number;
  rateType: RateType;
  subcategory?: string;
}
interface BudgetCategory {
  id: string;
  label: string;
  icon?: string;
  items: BudgetLineItem[];
  collapsed?: boolean;
}

/* ── Category display mapping (matches Budget Planning page) ─── */
type CategoryKey =
  | "talent"
  | "crew"
  | "equipment"
  | "locations"
  | "art"
  | "post"
  | "operations";

const CATEGORIES: { key: CategoryKey; label: string; tone: string }[] = [
  { key: "talent", label: "Talent", tone: "#34d399" },
  { key: "crew", label: "Crew", tone: "#f472b6" },
  { key: "equipment", label: "Equipment", tone: "#a78bfa" },
  { key: "locations", label: "Locations", tone: "#7dd3fc" },
  { key: "art", label: "Art", tone: "#fb923c" },
  { key: "post", label: "Post", tone: "#facc15" },
  { key: "operations", label: "Ops", tone: "#94a3b8" },
];

const PREFS_KEY = "shotflow.budgetBar.v2";

interface Prefs {
  enabled: Record<CategoryKey, boolean>;
  collapsed: boolean;
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

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
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

function fmt(n: number, symbol: string): string {
  if (!Number.isFinite(n) || n === 0) return `${symbol}0`;
  if (n >= 10_000_000) return `${symbol}${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${symbol}${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(n)}`;
}

/** Per-day burn for a single line item */
function itemPerDayBurn(item: BudgetLineItem): number {
  switch (item.rateType) {
    case "daily":
      return item.rate * item.quantity; // applies every shoot day
    case "weekly":
      return (item.rate * item.quantity) / 5; // per workday
    case "flat":
      return 0; // flat items counted separately as Fixed
    default:
      return 0;
  }
}

/** Flat portion of a line item (one-time project cost) */
function itemFlat(item: BudgetLineItem): number {
  return item.rateType === "flat" ? item.rate * item.quantity : 0;
}

interface BudgetBarProps {
  days: ScheduleShootDay[];
  board: ScheduleBoardState;
  project: ScheduleProject;
  onCellClick?: (dayId: string) => void;
}

export function BudgetBar({ days, board, project, onCellClick }: BudgetBarProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => defaultPrefs());
  const [budget, setBudget] = useState<BudgetCategory[] | null>(null);
  const cellsRef = useRef<HTMLDivElement | null>(null);

  // Load prefs + budget from localStorage (client only)
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      try {
        const raw = window.localStorage.getItem(`shotflow-budget-${project.id}`);
        setBudget(raw ? (JSON.parse(raw) as BudgetCategory[]) : null);
      } catch {
        setBudget(null);
      }
    };
    read();
    // Refresh when user returns to the tab (e.g., after editing Budget page)
    const onFocus = () => read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === `shotflow-budget-${project.id}`) read();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [project.id]);

  // Sync horizontal scroll with schedule grid
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
    cells.scrollLeft = grid.scrollLeft;
    return () => {
      grid.removeEventListener("scroll", onGridScroll);
      cells.removeEventListener("scroll", onCellsScroll);
    };
  }, [days.length, prefs.collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const symbol = project.currency === "INR" ? "₹" : "$";
  const cap = project.budgetCap || 0;

  /** Base per-day burn by category, derived from Budget Planning line items */
  const baseBurnByCategory = useMemo(() => {
    const byCat: Record<CategoryKey, number> = {
      talent: 0, crew: 0, equipment: 0, locations: 0, art: 0, post: 0, operations: 0,
    };
    if (!budget) return byCat;
    for (const cat of budget) {
      const key = cat.id as CategoryKey;
      if (!(key in byCat)) continue;
      const burn = cat.items.reduce((s, item) => s + itemPerDayBurn(item), 0);
      byCat[key] = burn;
    }
    return byCat;
  }, [budget]);

  /** Flat (one-time) total across all categories */
  const flatTotal = useMemo(() => {
    if (!budget) return 0;
    let sum = 0;
    for (const cat of budget) {
      for (const item of cat.items) sum += itemFlat(item);
    }
    return sum;
  }, [budget]);

  /** Per-day breakdown: baseline burn + day-specific overrides */
  function dayBreakdown(day: ScheduleShootDay): Record<CategoryKey, number> {
    const dayScenes = board[day.id] || [];
    const active = dayScenes.length > 0;
    const b: Record<CategoryKey, number> = {
      talent: active ? baseBurnByCategory.talent : 0,
      crew: active ? baseBurnByCategory.crew : 0,
      equipment: active ? baseBurnByCategory.equipment : 0,
      locations: active ? baseBurnByCategory.locations : 0,
      art: active ? baseBurnByCategory.art : 0,
      post: baseBurnByCategory.post,
      operations: active ? baseBurnByCategory.operations : 0,
    };
    // Day-specific additions entered on the shoot day
    b.locations += day.location?.dailyRentalCost || 0;
    const equipExtra = (day.equipmentLinks || []).reduce(
      (s, l) => s + (l.equipment?.dailyRental || 0) * (l.quantity || 1),
      0,
    );
    b.equipment += equipExtra;
    b.operations += (day.travelCost || 0) + (day.lodgingCost || 0) + (day.cateringCost || 0);
    return b;
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
    [days, board, prefs, baseBurnByCategory],
  );
  const grandTotal = grandDayOf + flatTotal;
  const overCap = cap > 0 && grandTotal > cap;
  const remaining = cap > 0 ? cap - grandTotal : 0;

  const toggle = (key: CategoryKey) => {
    setPrefs((p) => ({ ...p, enabled: { ...p.enabled, [key]: !p.enabled[key] } }));
  };

  const hasBudgetData = budget !== null && budget.length > 0;

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
            {flatTotal > 0 && <span className="budget-bar__expand-fixed"> + Fixed {fmt(flatTotal, symbol)}</span>}
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
          {flatTotal > 0 && (
            <span className="budget-bar__total-block">
              <span className="budget-bar__total-label">Fixed</span>
              <span className="budget-bar__total-value">{fmt(flatTotal, symbol)}</span>
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

      <div className="budget-bar__cells" ref={cellsRef}>
        {days.map((day) => {
          const b = dayBreakdown(day);
          const total = dayTotal(day);
          const enabledList = CATEGORIES.filter((c) => prefs.enabled[c.key] && b[c.key] > 0);
          const isEmpty = total === 0;
          const hint = !hasBudgetData
            ? "Open Budget Planning to set line items"
            : "Click to add day-specific costs";
          const title = isEmpty
            ? hint
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
                {enabledList.slice(0, 5).map((c) => (
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
