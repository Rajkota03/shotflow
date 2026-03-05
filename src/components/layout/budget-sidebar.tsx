"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDelta } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface BudgetSidebarProps {
  projectId: string;
  currency: string;
}

interface ChangeLog {
  id: string;
  changeType: string;
  description: string;
  costDelta: number;
  createdAt: string;
}

// What-If scenario type
interface WhatIfScenario {
  extraDays: number;
  extraCastDayRate: number;
  extraLocationCost: number;
  contingencyPct: number;
}

export function BudgetSidebar({ projectId, currency }: BudgetSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [scenario, setScenario] = useState<WhatIfScenario>({
    extraDays: 0, extraCastDayRate: 0, extraLocationCost: 0, contingencyPct: 10,
  });
  const { budget, isLoading, refreshBudget } = useBudgetStore();

  const { data: changelog = [] } = useQuery<ChangeLog[]>({
    queryKey: ["budget-changelog", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/budget/changelog`).then(r => r.json()),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const interval = setInterval(() => refreshBudget(projectId), 8000);
    return () => clearInterval(interval);
  }, [projectId, refreshBudget]);

  // Compute what-if projected total
  const whatIfDelta = budget
    ? (scenario.extraDays * (scenario.extraCastDayRate + scenario.extraLocationCost)) +
      (budget.totalProjected * (scenario.contingencyPct / 100)) -
      budget.contingency
    : 0;
  const whatIfTotal = budget ? budget.totalProjected + whatIfDelta : 0;
  const whatIfPct = budget?.budgetCap ? (whatIfTotal / budget.budgetCap) * 100 : 0;

  const activeBudget = whatIfMode
    ? { ...budget!, totalProjected: whatIfTotal, percentUsed: whatIfPct, variance: (budget?.budgetCap ?? 0) - whatIfTotal }
    : budget;

  const pct = activeBudget?.percentUsed ?? 0;
  const barColor = pct >= 100 ? "#ef4444" : pct >= 85 ? "#f59e0b" : "#10b981";

  if (collapsed) {
    return (
      <div className="w-10 border-l border-[#1a1a1a] flex flex-col items-center py-4 gap-4 flex-shrink-0">
        <button onClick={() => setCollapsed(false)} className="text-[#666] hover:text-white" title="Expand budget">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </button>
        {budget && (
          <div className="w-1.5 flex-1 rounded-full bg-[#1a1a1a] relative overflow-hidden" title={`${pct.toFixed(0)}% of budget used`}>
            <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all" style={{ height: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 border-l border-[#1a1a1a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Budget</span>
          {whatIfMode && (
            <span className="text-[9px] bg-[#f59e0b]/20 text-[#f59e0b] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
              What-If
            </span>
          )}
        </div>
        <button onClick={() => setCollapsed(true)} className="text-[#555] hover:text-[#888]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading && !budget ? (
          <div className="text-[#555] text-xs">Calculating...</div>
        ) : activeBudget ? (
          <>
            {/* Total vs Cap */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[#555] uppercase tracking-wider">Total vs Cap</span>
                <span className="text-[10px]" style={{ color: barColor }}>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <div>
                  <span className="text-[11px] text-white font-mono">{formatCurrency(activeBudget.totalProjected, currency)}</span>
                  {whatIfMode && whatIfDelta !== 0 && (
                    <span className="text-[10px] ml-1 font-mono" style={{ color: whatIfDelta > 0 ? "#ef4444" : "#10b981" }}>
                      ({whatIfDelta > 0 ? "+" : ""}{formatCurrency(Math.abs(whatIfDelta), currency)})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#555] font-mono">/ {formatCurrency(activeBudget.budgetCap, currency)}</span>
              </div>
              {activeBudget.variance < 0 && (
                <div className="mt-1 text-[10px] text-[#ef4444]">
                  Over budget by {formatCurrency(Math.abs(activeBudget.variance), currency)}
                </div>
              )}
            </div>

            {/* Department Breakdown */}
            {!whatIfMode && (
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Departments</p>
                <div className="space-y-1.5">
                  {budget!.departments.map(dept => (
                    <div key={dept.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                      <span className="text-[11px] text-[#888] flex-1 truncate">{dept.name}</span>
                      <span className="text-[11px] text-white font-mono">{formatCurrency(dept.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Line Items */}
            {!whatIfMode && (
              <div className="border-t border-[#1a1a1a] pt-4 space-y-1">
                {[
                  { label: "Above Line", val: budget!.aboveTheLine },
                  { label: "Below Line", val: budget!.belowTheLine },
                  { label: "Post/VFX", val: budget!.postProduction },
                  { label: "Contingency (10%)", val: budget!.contingency },
                ].map(item => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-[11px] text-[#555]">{item.label}</span>
                    <span className="text-[11px] text-[#888] font-mono">{formatCurrency(item.val, currency)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* What-If Controls */}
            {whatIfMode && (
              <div className="space-y-3">
                <p className="text-[10px] text-[#f59e0b] uppercase tracking-wider">Scenario Variables</p>
                <div>
                  <label className="text-[10px] text-[#555] block mb-1">Extra Shoot Days</label>
                  <input
                    type="number" min="0"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                    value={scenario.extraDays}
                    onChange={e => setScenario(s => ({ ...s, extraDays: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#555] block mb-1">Additional Cast Rate / Day</label>
                  <input
                    type="number" min="0"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                    value={scenario.extraCastDayRate}
                    onChange={e => setScenario(s => ({ ...s, extraCastDayRate: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#555] block mb-1">Additional Location Cost / Day</label>
                  <input
                    type="number" min="0"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                    value={scenario.extraLocationCost}
                    onChange={e => setScenario(s => ({ ...s, extraLocationCost: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#555] block mb-1">Contingency %</label>
                  <input
                    type="number" min="0" max="50"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                    value={scenario.contingencyPct}
                    onChange={e => setScenario(s => ({ ...s, contingencyPct: Number(e.target.value) }))}
                  />
                </div>
                {whatIfDelta !== 0 && (
                  <div className={`rounded-lg p-3 ${whatIfDelta > 0 ? "bg-[#ef4444]/10 border border-[#ef4444]/20" : "bg-[#10b981]/10 border border-[#10b981]/20"}`}>
                    <p className="text-[10px] text-[#888]">Projected impact</p>
                    <p className="text-sm font-mono font-bold mt-0.5" style={{ color: whatIfDelta > 0 ? "#ef4444" : "#10b981" }}>
                      {whatIfDelta > 0 ? "+" : ""}{formatCurrency(Math.abs(whatIfDelta), currency)}
                    </p>
                    <p className="text-[10px] text-[#555] mt-0.5">
                      {whatIfPct.toFixed(0)}% of cap → {whatIfPct >= 100 ? "Exceeds budget" : `${(100 - whatIfPct).toFixed(0)}% headroom`}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => { setScenario({ extraDays: 0, extraCastDayRate: 0, extraLocationCost: 0, contingencyPct: 10 }); }}
                  className="w-full py-1.5 text-[10px] text-[#555] hover:text-[#888] bg-[#0f0f0f] rounded-lg transition-colors"
                >
                  Reset Scenario
                </button>
              </div>
            )}

            {/* Alerts */}
            {pct >= 85 && !whatIfMode && (
              <div className={`rounded-lg p-3 ${pct >= 100 ? "bg-[#ef4444]/10 border border-[#ef4444]/20" : "bg-[#f59e0b]/10 border border-[#f59e0b]/20"}`}>
                <p className={`text-[11px] font-medium ${pct >= 100 ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>
                  {pct >= 100 ? "Budget exceeded!" : "Approaching budget limit"}
                </p>
                <p className="text-[10px] text-[#888] mt-0.5">
                  {pct >= 100 ? `Over by ${formatCurrency(Math.abs(activeBudget.variance), currency)}` : `${(100 - pct).toFixed(0)}% remaining`}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-[#555] text-xs">No budget data</div>
        )}

        {/* Recent Changes */}
        {changelog.length > 0 && !whatIfMode && (
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Recent Changes</p>
            <div className="space-y-2">
              {changelog.slice(0, 5).map(log => (
                <div key={log.id} className="bg-[#0f0f0f] rounded-lg p-2.5">
                  <p className="text-[11px] text-[#ccc] leading-tight">{log.description}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono font-medium" style={{ color: log.costDelta >= 0 ? "#ef4444" : "#10b981" }}>
                      {log.costDelta !== 0 ? formatDelta(log.costDelta, currency) : "—"}
                    </span>
                    <span className="text-[10px] text-[#444]">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#1a1a1a] space-y-2">
        {/* What-If Toggle */}
        <button
          onClick={() => setWhatIfMode(w => !w)}
          className={`w-full py-1.5 text-[10px] rounded-lg transition-colors font-medium uppercase tracking-wider ${
            whatIfMode
              ? "bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30"
              : "bg-[#0f0f0f] text-[#555] hover:text-[#888]"
          }`}
        >
          {whatIfMode ? "Exit What-If Mode" : "What-If Sandbox"}
        </button>
        <button
          onClick={() => refreshBudget(projectId)}
          className="w-full py-1.5 text-[10px] text-[#333] hover:text-[#555] bg-[#0a0a0a] rounded-lg transition-colors uppercase tracking-wider"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
