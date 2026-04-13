"use client";
import { use, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface CastMember {
  id: string;
  name: string;
  characterName: string | null;
  roleType: string;
  paymentMode: "per_day" | "package";
  dayRate: number;
  packageFee: number;
  travelRequired: boolean;
  availableDates: string | null; // JSON array of date strings
  notes: string | null;
  sceneLinks: { scene: { id: string; sceneNumber: string; sceneName: string } }[];
}

interface Project {
  id: string;
  currency: string;
  shootDays: { id: string; scenes: { id: string }[] }[];
}

const ROLE_COLORS: Record<string, string> = {
  lead: "#f59e0b",
  supporting: "#3b82f6",
  day_player: "#10b981",
  extra: "#6b7280",
};

const ROLE_LABELS: Record<string, string> = {
  lead: "Lead",
  supporting: "Supporting",
  day_player: "Day Player",
  extra: "Extra",
};

export default function CastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore((s) => s.refreshBudget);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, { name: string; characterName: string; dayRate: string; roleType: string; paymentMode: "per_day" | "package"; packageFee: string }>>({});
  const [editingCharName, setEditingCharName] = useState<string | null>(null);
  const charNameRef = useRef<HTMLInputElement>(null);
  const [availabilityId, setAvailabilityId] = useState<string | null>(null);

  const { data: project } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: cast = [], isLoading } = useQuery<CastMember[]>({
    queryKey: ["cast", id],
    queryFn: () => fetch(`/api/projects/${id}/cast`).then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ castId, data }: { castId: string; data: { name?: string; characterName?: string; dayRate?: number; packageFee?: number; paymentMode?: "per_day" | "package"; roleType?: string } }) =>
      fetch(`/api/projects/${id}/cast/${castId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cast", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      refreshBudget(id);
      setEditingId(null);
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: ({ castId, dates }: { castId: string; dates: string[] }) =>
      fetch(`/api/projects/${id}/cast/${castId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableDates: JSON.stringify(dates) }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cast", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (castId: string) =>
      fetch(`/api/projects/${id}/cast/${castId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cast", id] });
      refreshBudget(id);
    },
  });

  // Calculate shoot days per character
  function getShootDays(member: CastMember): number {
    if (!project) return 0;
    const sceneIds = new Set(member.sceneLinks.map((l) => l.scene.id));
    const days = new Set<string>();
    for (const day of project.shootDays) {
      for (const scene of day.scenes) {
        if (sceneIds.has(scene.id)) {
          days.add(day.id);
          break;
        }
      }
    }
    return days.size;
  }

  const currency = project?.currency || "INR";
  const symbol = currency === "INR" ? "₹" : "$";

  // Group by role type
  const grouped = {
    lead: cast.filter((c) => c.roleType === "lead"),
    supporting: cast.filter((c) => c.roleType === "supporting"),
    day_player: cast.filter((c) => c.roleType === "day_player"),
    extra: cast.filter((c) => c.roleType === "extra"),
  };

  const totalDaily = cast.reduce((s, c) => s + c.dayRate, 0);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--border-strong)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  function startEdit(member: CastMember) {
    setEditingId(member.id);
    setEditFields((prev) => ({
      ...prev,
      [member.id]: {
        name: member.name || "",
        characterName: member.characterName || "",
        dayRate: String(member.dayRate || ""),
        packageFee: String(member.packageFee || ""),
        paymentMode: member.paymentMode || "per_day",
        roleType: member.roleType,
      },
    }));
  }

  function saveEdit(castId: string) {
    const fields = editFields[castId];
    if (!fields) return;
    updateMutation.mutate({
      castId,
      data: {
        name: fields.name,
        characterName: fields.characterName,
        paymentMode: fields.paymentMode,
        dayRate: Number(fields.dayRate) || 0,
        packageFee: Number(fields.packageFee) || 0,
        roleType: fields.roleType,
      },
    });
  }

  function startCharNameEdit(member: CastMember) {
    setEditingCharName(member.id);
    setEditFields((prev) => ({
      ...prev,
      [member.id]: {
        ...prev[member.id],
        name: member.name || "",
        characterName: member.characterName || "",
        dayRate: String(member.dayRate || ""),
        packageFee: String(member.packageFee || ""),
        paymentMode: member.paymentMode || "per_day",
        roleType: member.roleType,
      },
    }));
    setTimeout(() => charNameRef.current?.focus(), 0);
  }

  function saveCharName(castId: string) {
    const fields = editFields[castId];
    if (!fields?.characterName?.trim()) { setEditingCharName(null); return; }
    updateMutation.mutate({ castId, data: { characterName: fields.characterName.trim() } });
    setEditingCharName(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>Cast & Talent</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}>
            {cast.length} characters from script · {formatCurrency(totalDaily, currency)}/day total
          </p>
        </div>
      </div>

      {cast.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 24px",
          background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
          borderRadius: 16,
        }}>
          <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", marginBottom: 8 }}>No characters yet</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Import a script to auto-populate characters from your screenplay</p>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", marginBottom: 20,
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)",
            borderRadius: 10, fontSize: "var(--text-sm)", color: "var(--text-secondary)",
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            Characters were auto-extracted from your script. Fill in the <strong style={{ color: "var(--text-primary)" }}>actor name</strong> and <strong style={{ color: "var(--text-primary)" }}>day rate</strong> for each.
          </div>

          {/* Role groups */}
          {(["lead", "supporting", "day_player", "extra"] as const).map((role) => {
            const members = grouped[role];
            if (members.length === 0) return null;
            return (
              <div key={role} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                    padding: "3px 8px", borderRadius: 6,
                    background: `${ROLE_COLORS[role]}15`, color: ROLE_COLORS[role],
                  }}>
                    {ROLE_LABELS[role]}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    {members.length} character{members.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {members.map((member) => {
                    const isEditing = editingId === member.id;
                    const fields = editFields[member.id];
                    const shootDays = getShootDays(member);
                    const estimatedCost = member.dayRate * Math.max(shootDays, member.sceneLinks.length > 0 ? 1 : 0);

                    return (
                      <div
                        key={member.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 180px 100px 80px 70px 60px",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 16px",
                          background: "var(--bg-surface-2)",
                          border: `1px solid ${isEditing ? "var(--blue-border)" : "var(--border-subtle)"}`,
                          borderRadius: 10,
                          transition: "border-color 0.15s",
                        }}
                      >
                        {/* Character + Actor */}
                        <div>
                          {editingCharName === member.id ? (
                            <input
                              ref={charNameRef}
                              autoFocus
                              value={editFields[member.id]?.characterName || ""}
                              onChange={(e) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  [member.id]: { ...prev[member.id], characterName: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCharName(member.id);
                                if (e.key === "Escape") setEditingCharName(null);
                              }}
                              onBlur={() => saveCharName(member.id)}
                              style={{
                                fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)",
                                background: "var(--bg-surface-1)", border: "1px solid var(--blue-border)",
                                borderRadius: 6, padding: "2px 8px", outline: "none", width: "100%", maxWidth: 200,
                                boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                              }}
                            />
                          ) : (
                            <div
                              style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", cursor: "default" }}
                              onDoubleClick={() => startCharNameEdit(member)}
                              title="Double-click to edit character name"
                            >
                              {member.characterName || "Unknown"}
                            </div>
                          )}
                          {isEditing ? (
                            <input
                              autoFocus
                              placeholder="Enter actor name..."
                              value={fields?.name || ""}
                              onChange={(e) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  [member.id]: { ...prev[member.id], name: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => e.key === "Enter" && saveEdit(member.id)}
                              style={{
                                marginTop: 4, width: "100%", maxWidth: 200,
                                background: "var(--bg-surface-1)", border: "1px solid var(--border-strong)",
                                borderRadius: 6, padding: "4px 8px",
                                fontSize: "var(--text-xs)", color: "var(--text-primary)",
                                outline: "none",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: "var(--text-xs)",
                                color: member.name ? "var(--text-secondary)" : "var(--text-tertiary)",
                                marginTop: 2,
                                cursor: "pointer",
                              }}
                              onClick={() => startEdit(member)}
                            >
                              {member.name || "Click to assign actor →"}
                            </div>
                          )}
                        </div>

                        {/* Scenes */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {[...member.sceneLinks]
                            .sort((a, b) => {
                              const numA = parseInt(a.scene.sceneNumber) || 0;
                              const numB = parseInt(b.scene.sceneNumber) || 0;
                              if (numA !== numB) return numA - numB;
                              return a.scene.sceneNumber.localeCompare(b.scene.sceneNumber);
                            })
                            .slice(0, 5).map((l) => (
                            <span
                              key={l.scene.id}
                              style={{
                                fontSize: 10, padding: "2px 6px",
                                background: "var(--bg-surface-3)", color: "var(--text-secondary)",
                                borderRadius: 4,
                              }}
                            >
                              Sc {l.scene.sceneNumber}
                            </span>
                          ))}
                          {member.sceneLinks.length > 5 && (
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                              +{member.sceneLinks.length - 5}
                            </span>
                          )}
                          {member.sceneLinks.length === 0 && (
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </div>

                        {/* Day Rate / Package Fee */}
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", gap: 2 }}>
                              <button
                                type="button"
                                onClick={() => setEditFields((prev) => ({ ...prev, [member.id]: { ...prev[member.id], paymentMode: "per_day" } }))}
                                style={{
                                  flex: 1, padding: "2px 4px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                                  background: fields?.paymentMode === "per_day" ? "var(--amber-subtle)" : "transparent",
                                  color: fields?.paymentMode === "per_day" ? "var(--amber)" : "var(--text-tertiary)",
                                  border: `1px solid ${fields?.paymentMode === "per_day" ? "var(--amber)" : "var(--border-subtle)"}`,
                                }}
                              >Day</button>
                              <button
                                type="button"
                                onClick={() => setEditFields((prev) => ({ ...prev, [member.id]: { ...prev[member.id], paymentMode: "package" } }))}
                                style={{
                                  flex: 1, padding: "2px 4px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                                  background: fields?.paymentMode === "package" ? "var(--amber-subtle)" : "transparent",
                                  color: fields?.paymentMode === "package" ? "var(--amber)" : "var(--text-tertiary)",
                                  border: `1px solid ${fields?.paymentMode === "package" ? "var(--amber)" : "var(--border-subtle)"}`,
                                }}
                              >Pkg</button>
                            </div>
                            <input
                              type="number"
                              placeholder="0"
                              value={fields?.paymentMode === "package" ? (fields?.packageFee || "") : (fields?.dayRate || "")}
                              onChange={(e) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  [member.id]: fields?.paymentMode === "package"
                                    ? { ...prev[member.id], packageFee: e.target.value }
                                    : { ...prev[member.id], dayRate: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => e.key === "Enter" && saveEdit(member.id)}
                              style={{
                                width: "100%",
                                background: "var(--bg-surface-1)", border: "1px solid var(--border-strong)",
                                borderRadius: 6, padding: "4px 6px",
                                fontSize: "var(--text-xs)", color: "var(--text-primary)",
                                outline: "none", fontFamily: "var(--font-mono)",
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1, cursor: "pointer" }} onClick={() => startEdit(member)}>
                            <span
                              style={{
                                fontSize: "var(--text-sm)", fontFamily: "var(--font-mono)",
                                color: (member.paymentMode === "package" ? member.packageFee : member.dayRate) > 0 ? "var(--text-primary)" : "var(--text-tertiary)",
                              }}
                            >
                              {(member.paymentMode === "package" ? member.packageFee : member.dayRate) > 0
                                ? formatCurrency(member.paymentMode === "package" ? member.packageFee : member.dayRate, currency)
                                : `${symbol}—`}
                            </span>
                            <span style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {member.paymentMode === "package" ? "Package" : "Per day"}
                            </span>
                          </div>
                        )}

                        {/* Scenes count */}
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textAlign: "center" }}>
                          {member.sceneLinks.length} sc
                        </span>

                        {/* Shoot days */}
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textAlign: "center" }}>
                          {shootDays > 0 ? `${shootDays}d` : "—"}
                        </span>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(member.id)}
                                style={{
                                  padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                  background: "var(--blue)", color: "white",
                                  border: "none", borderRadius: 6, cursor: "pointer",
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                style={{
                                  padding: "4px 8px", fontSize: 11,
                                  background: "transparent", color: "var(--text-tertiary)",
                                  border: "1px solid var(--border-default)", borderRadius: 6, cursor: "pointer",
                                }}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setAvailabilityId(member.id)}
                                title="Set availability dates"
                                style={{
                                  padding: "4px 8px", fontSize: 11,
                                  background: member.availableDates ? "rgba(16,185,129,0.1)" : "transparent",
                                  color: member.availableDates ? "#10b981" : "var(--text-tertiary)",
                                  border: `1px solid ${member.availableDates ? "rgba(16,185,129,0.2)" : "var(--border-subtle)"}`,
                                  borderRadius: 6, cursor: "pointer",
                                }}
                              >
                                📅
                              </button>
                              <button
                                onClick={() => startEdit(member)}
                                style={{
                                  padding: "4px 8px", fontSize: 11,
                                  background: "transparent", color: "var(--text-tertiary)",
                                  border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${member.characterName || "this character"}?`))
                                    deleteMutation.mutate(member.id);
                                }}
                                style={{
                                  padding: "4px 6px", fontSize: 11,
                                  background: "transparent", color: "var(--text-tertiary)",
                                  border: "none", cursor: "pointer",
                                }}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8,
            padding: "16px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
            borderRadius: 12,
          }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Daily Rate</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: 4 }}>
                {formatCurrency(totalDaily, currency)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Actors Assigned</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: 4 }}>
                {cast.filter((c) => c.name).length}/{cast.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rates Set</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: 4 }}>
                {cast.filter((c) => c.dayRate > 0).length}/{cast.length}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Availability Calendar Modal */}
      {availabilityId && (
        <AvailabilityCalendar
          member={cast.find((c) => c.id === availabilityId)!}
          onSave={(dates) => {
            availabilityMutation.mutate({ castId: availabilityId, dates });
            setAvailabilityId(null);
          }}
          onClose={() => setAvailabilityId(null)}
        />
      )}
    </div>
  );
}

/* ── Availability Calendar ─────────────────────────── */

function AvailabilityCalendar({
  member,
  onSave,
  onClose,
}: {
  member: CastMember;
  onSave: (dates: string[]) => void;
  onClose: () => void;
}) {
  const existing: string[] = member.availableDates ? JSON.parse(member.availableDates) : [];
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(existing));
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const prevMonth = () => {
    setViewMonth((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  };

  const nextMonth = () => {
    setViewMonth((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  };

  // Select/deselect all days in current month
  const selectAllMonth = () => {
    const next = new Set(selectedDates);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      next.add(ds);
    }
    setSelectedDates(next);
  };

  const clearMonth = () => {
    const next = new Set(selectedDates);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      next.delete(ds);
    }
    setSelectedDates(next);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderRadius: 16, padding: 24, width: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              Availability: {member.characterName || member.name}
            </h3>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              Click dates when this actor is <strong style={{ color: "#10b981" }}>available</strong>. Green = available.
            </p>
          </div>
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 18, padding: "4px 8px" }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 18, padding: "4px 8px" }}>›</button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, padding: 4 }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = selectedDates.has(dateStr);
            const today = new Date().toISOString().split("T")[0];
            const isToday = dateStr === today;
            return (
              <button
                key={day}
                onClick={() => toggleDate(dateStr)}
                style={{
                  width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: isToday ? 700 : 400, borderRadius: 8,
                  border: isToday ? "1px solid var(--amber)" : "1px solid transparent",
                  background: isSelected ? "rgba(16, 185, 129, 0.2)" : "transparent",
                  color: isSelected ? "#10b981" : "var(--text-secondary)",
                  cursor: "pointer", transition: "all 0.1s",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={selectAllMonth} style={{ flex: 1, padding: "6px", fontSize: 11, background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, cursor: "pointer" }}>
            Select All
          </button>
          <button onClick={clearMonth} style={{ flex: 1, padding: "6px", fontSize: 11, background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer" }}>
            Clear Month
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 8 }}>
          {selectedDates.size} days selected
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 16px", fontSize: 12, background: "var(--bg-surface-3)", color: "var(--text-secondary)", border: "none", borderRadius: 8, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(Array.from(selectedDates).sort())}
            style={{ flex: 1, padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "var(--amber)", color: "var(--bg-void)", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            Save Availability
          </button>
        </div>
      </div>
    </div>
  );
}
