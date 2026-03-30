"use client";
import { useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface ScheduleConfig {
  name: string;
  startDate: string;
  endDate: string;
  shootWeekdays: boolean[];
  callTime: string;
  wrapTime: string;
  overtimeAfter: number;
  turnaroundHours: number;
  blockedDates: string[];
  groupBy: "location" | "cast" | "sequence";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: scenes = [] } = useQuery<{ id: string; pageCount: number }[]>({
    queryKey: ["scenes", id],
    queryFn: () => fetch(`/api/projects/${id}/scenes`).then((r) => r.json()),
  });

  const [config, setConfig] = useState<ScheduleConfig>({
    name: "Main Schedule",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    shootWeekdays: [true, true, true, true, true, false, false],
    callTime: "07:00",
    wrapTime: "19:00",
    overtimeAfter: 12,
    turnaroundHours: 10,
    blockedDates: [],
    groupBy: "location",
  });

  const [newBlockedDate, setNewBlockedDate] = useState("");

  const update = <K extends keyof ScheduleConfig>(key: K, value: ScheduleConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleWeekday = (idx: number) => {
    const next = [...config.shootWeekdays];
    next[idx] = !next[idx];
    update("shootWeekdays", next);
  };

  const addBlockedDate = () => {
    if (newBlockedDate && !config.blockedDates.includes(newBlockedDate)) {
      update("blockedDates", [...config.blockedDates, newBlockedDate]);
      setNewBlockedDate("");
    }
  };

  const removeBlockedDate = (date: string) => {
    update("blockedDates", config.blockedDates.filter((d) => d !== date));
  };

  // Forecast calculation
  const totalPages = scenes.reduce((s, sc) => s + (sc.pageCount || 1), 0);
  const avgPagesPerDay = 3.5;
  const shootDaysPerWeek = config.shootWeekdays.filter(Boolean).length;
  const estimatedShootDays = Math.ceil(totalPages / avgPagesPerDay);
  const estimatedWeeks = shootDaysPerWeek > 0 ? Math.ceil(estimatedShootDays / shootDaysPerWeek) : 0;
  const estimatedCalendarDays = estimatedWeeks * 7;

  const computedEndDate = config.startDate
    ? new Date(new Date(config.startDate).getTime() + estimatedCalendarDays * 86400000).toISOString().split("T")[0]
    : "";

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${id}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name,
          startDate: config.startDate,
          endDate: config.endDate || computedEndDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to create schedule");
      const schedule = await res.json();

      // Add blocked dates
      for (const date of config.blockedDates) {
        await fetch(`/api/projects/${id}/schedules/${schedule.id}/blocked-dates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, reason: "Holiday" }),
        });
      }

      return schedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast("Schedule created", "success");
      router.push(`/projects/${id}/schedule`);
    },
    onError: () => {
      toast("Failed to create schedule", "error");
    },
  });

  return (
    <div className="flex h-full">
      {/* Left — Config Form */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-[560px] mx-auto">
          <h1 className="text-tier-1 mb-1">Schedule Setup</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 32 }}>
            Configure your shooting schedule parameters before auto-generating shoot days.
          </p>

          {/* Schedule Name */}
          <div className="mb-6">
            <label className="sf-label">Schedule Name</label>
            <input
              className="sf-input"
              value={config.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Main Schedule"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="sf-label">Start Date</label>
              <input
                className="sf-date-input"
                type="date"
                value={config.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div>
              <label className="sf-label">End Date (optional)</label>
              <input
                className="sf-date-input"
                type="date"
                value={config.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                placeholder={computedEndDate}
              />
              {!config.endDate && computedEndDate && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Estimated: {computedEndDate}
                </p>
              )}
            </div>
          </div>

          {/* Shoot Days */}
          <div className="mb-6">
            <label className="sf-label">Shoot Days</label>
            <div className="flex gap-2">
              {WEEKDAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleWeekday(i)}
                  className="flex-1 py-2 rounded-lg text-center transition-all"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: "var(--weight-medium)",
                    background: config.shootWeekdays[i] ? "var(--blue-subtle)" : "var(--bg-surface-2)",
                    color: config.shootWeekdays[i] ? "var(--blue-primary)" : "var(--text-tertiary)",
                    border: config.shootWeekdays[i] ? "1px solid var(--blue-border)" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Call / Wrap Times */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="sf-label">Call Time</label>
              <input className="sf-input" type="time" value={config.callTime} onChange={(e) => update("callTime", e.target.value)} />
            </div>
            <div>
              <label className="sf-label">Estimated Wrap</label>
              <input className="sf-input" type="time" value={config.wrapTime} onChange={(e) => update("wrapTime", e.target.value)} />
            </div>
          </div>

          {/* Overtime + Turnaround */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="sf-label">Overtime After (hrs)</label>
              <input
                className="sf-input"
                type="number"
                min={8}
                max={16}
                value={config.overtimeAfter}
                onChange={(e) => update("overtimeAfter", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="sf-label">Min Turnaround (hrs)</label>
              <input
                className="sf-input"
                type="number"
                min={8}
                max={14}
                value={config.turnaroundHours}
                onChange={(e) => update("turnaroundHours", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Blocked Dates */}
          <div className="mb-6">
            <label className="sf-label">Blocked Dates / Holidays</label>
            <div className="flex gap-2 mb-2">
              <input
                className="sf-date-input"
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button variant="secondary" size="sm" onClick={addBlockedDate}>
                Add
              </Button>
            </div>
            {config.blockedDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.blockedDates.map((d) => (
                  <Badge key={d} variant="warning">
                    {d}
                    <button
                      onClick={() => removeBlockedDate(d)}
                      style={{ marginLeft: 4, cursor: "pointer", background: "none", border: "none", color: "inherit", fontSize: 12 }}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Grouping Preference */}
          <div className="mb-8">
            <label className="sf-label">Scheduling Priority</label>
            <div className="flex gap-2">
              {([
                { key: "location" as const, label: "By Location", desc: "Minimize moves" },
                { key: "cast" as const, label: "By Cast", desc: "Minimize actor days" },
                { key: "sequence" as const, label: "Script Order", desc: "Shoot in order" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => update("groupBy", opt.key)}
                  className="flex-1 p-3 rounded-lg text-left transition-all"
                  style={{
                    background: config.groupBy === opt.key ? "var(--blue-subtle)" : "var(--bg-surface-2)",
                    border: config.groupBy === opt.key ? "1px solid var(--blue-border)" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: config.groupBy === opt.key ? "var(--blue-primary)" : "var(--text-primary)", marginBottom: 2 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => createScheduleMutation.mutate()} disabled={createScheduleMutation.isPending}>
            {createScheduleMutation.isPending ? "Creating..." : "Create Schedule & Generate Days"}
          </Button>
        </div>
      </div>

      {/* Right — Live Forecast Panel */}
      <div className="w-[320px] flex-shrink-0 overflow-y-auto p-6" style={{ background: "var(--bg-surface-1)", borderLeft: "1px solid var(--border-subtle)" }}>
        <h3 style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)", marginBottom: 24 }}>
          Schedule Forecast
        </h3>

        <div className="space-y-5">
          {/* Key Metrics */}
          {[
            { label: "Total Scenes", value: String(scenes.length), unit: "scenes" },
            { label: "Total Pages", value: totalPages.toFixed(1), unit: "pp" },
            { label: "Avg Pages/Day", value: avgPagesPerDay.toFixed(1), unit: "pp/day" },
            { label: "Est. Shoot Days", value: String(estimatedShootDays), unit: "days" },
            { label: "Shoot Days/Week", value: String(shootDaysPerWeek), unit: "days" },
            { label: "Est. Calendar Weeks", value: String(estimatedWeeks), unit: "weeks" },
          ].map((m) => (
            <div key={m.label} className="flex items-center justify-between">
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{m.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-mono-num" style={{ fontSize: "var(--text-md)", color: "var(--text-primary)" }}>
                  {m.value}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{m.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline visualization */}
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-tier-2 mb-3">Timeline</p>
          <div className="rounded-lg p-4" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Start</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Wrap</span>
            </div>
            <div className="sf-progress" style={{ height: 8, marginBottom: 8 }}>
              <div className="sf-progress-bar green" style={{ width: "100%", borderRadius: 4 }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mono-num" style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                {config.startDate || "—"}
              </span>
              <span className="text-mono-num" style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                {config.endDate || computedEndDate || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Working hours */}
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-tier-2 mb-3">Daily Schedule</p>
          <div className="space-y-2">
            <div className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Call Time</span>
              <span className="text-mono-num" style={{ color: "var(--text-primary)" }}>{config.callTime}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Est. Wrap</span>
              <span className="text-mono-num" style={{ color: "var(--text-primary)" }}>{config.wrapTime}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
              <span style={{ color: "var(--text-secondary)" }}>OT After</span>
              <span className="text-mono-num" style={{ color: "var(--text-primary)" }}>{config.overtimeAfter}h</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Turnaround</span>
              <span className="text-mono-num" style={{ color: "var(--text-primary)" }}>{config.turnaroundHours}h min</span>
            </div>
          </div>
        </div>

        {config.blockedDates.length > 0 && (
          <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-tier-2 mb-2">Blocked Dates</p>
            <p className="text-mono-num" style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              {config.blockedDates.length} date{config.blockedDates.length !== 1 ? "s" : ""} blocked
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
