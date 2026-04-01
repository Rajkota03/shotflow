"use client";

import React, { useState, useMemo, useCallback, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ArrowUpDown,
  Filter,
  Download,
  MapPin,
  X,
  Archive,
  Undo2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

/* ── Types ─────────────────────────────────────────────── */

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  synopsis: string;
  status: string;
  shootDayId: string | null;
  shootDay?: { dayNumber: number };
  castLinks?: { castMember: { name: string } }[];
}

type SortKey = "sceneNumber" | "pageCount" | "status" | "sceneName";
type SortDir = "asc" | "desc";

/* ── Helpers ───────────────────────────────────────────── */

function deriveStatus(s: Scene): "Ready" | "Incomplete" | "Scheduled" | "Boneyard" {
  if (s.status === "boneyard") return "Boneyard";
  if (s.shootDayId) return "Scheduled";
  if (s.intExt && s.dayNight && s.pageCount > 0 && s.sceneName) return "Ready";
  return "Incomplete";
}

function getWarnings(s: Scene): string[] {
  const w: string[] = [];
  if (!s.sceneName) w.push("Location not assigned");
  if (!s.intExt) w.push("INT/EXT not set");
  if (!s.dayNight) w.push("DAY/NIGHT not set");
  if (!s.pageCount || s.pageCount <= 0) w.push("Page count missing");
  return w;
}

/** Natural sort for scene numbers: "1" < "2" < "10" < "70" < "70A" < "70B" */
function naturalSceneSort(a: string, b: string): number {
  const numA = parseInt(a) || 0;
  const numB = parseInt(b) || 0;
  if (numA !== numB) return numA - numB;
  const suffA = a.replace(/^\d+/, "");
  const suffB = b.replace(/^\d+/, "");
  return suffA.localeCompare(suffB);
}

/** Get the base scene number (e.g., "70" from "70A", "70B") */
function baseSceneNumber(sceneNum: string): string {
  return sceneNum.replace(/[A-Za-z]+$/, "");
}

const STATUS_BADGE: Record<string, string> = {
  Ready: "sf-badge--green",
  Incomplete: "sf-badge--amber",
  Scheduled: "sf-badge--blue",
  Boneyard: "sf-badge--muted",
};

/* ── Component ─────────────────────────────────────────── */

export default function SceneListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState<"scriptyard" | "boneyard">("scriptyard");
  const [sortKey, setSortKey] = useState<SortKey>("sceneNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterIE, setFilterIE] = useState<"all" | "INT" | "EXT">("all");
  const [filterDN, setFilterDN] = useState<"all" | "DAY" | "NIGHT">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Data
  const { data: scenes = [], isLoading } = useQuery<Scene[]>({
    queryKey: ["scenes", id],
    queryFn: () =>
      fetch(`/api/projects/${id}/scenes`).then((r) => r.json()),
  });

  // Boneyard mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ sceneIds, status }: { sceneIds: string[]; status: string }) => {
      await Promise.all(
        sceneIds.map((sceneId) =>
          fetch(`/api/projects/${id}/scenes/${sceneId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenes", id] });
      setSelected(new Set());
    },
  });

  // Sort toggle
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
      setSortOpen(false);
    },
    [sortKey],
  );

  // Split scenes into scriptyard vs boneyard
  const scriptyardScenes = useMemo(() => scenes.filter((s) => s.status !== "boneyard"), [scenes]);
  const boneyardScenes = useMemo(() => scenes.filter((s) => s.status === "boneyard"), [scenes]);
  const activeScenes = tab === "scriptyard" ? scriptyardScenes : boneyardScenes;

  // Count unique base scene numbers (70, 70A, 70B = 1 scene)
  const uniqueSceneCount = useMemo(() => {
    const bases = new Set(scriptyardScenes.map((s) => baseSceneNumber(s.sceneNumber)));
    return bases.size;
  }, [scriptyardScenes]);

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let list = [...activeScenes];

    if (filterIE !== "all") list = list.filter((s) => s.intExt === filterIE);
    if (filterDN !== "all") list = list.filter((s) => s.dayNight === filterDN);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.sceneName?.toLowerCase().includes(q) ||
          s.sceneNumber.toLowerCase().includes(q) ||
          s.castLinks?.some((c) =>
            c.castMember.name.toLowerCase().includes(q),
          ),
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "pageCount":
          return (a.pageCount - b.pageCount) * dir;
        case "status":
          return deriveStatus(a).localeCompare(deriveStatus(b)) * dir;
        case "sceneName":
          return (a.sceneName ?? "").localeCompare(b.sceneName ?? "") * dir;
        default:
          return naturalSceneSort(a.sceneNumber, b.sceneNumber) * dir;
      }
    });

    return list;
  }, [activeScenes, filterIE, filterDN, search, sortKey, sortDir]);

  const totalPages = filtered.reduce((acc, s) => acc + s.pageCount, 0);

  // Selection helpers
  const allSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const toggleSelect = (sceneId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const moveToBoneyard = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    updateStatusMutation.mutate(
      { sceneIds: ids, status: "boneyard" },
      {
        onSuccess: () => toast(`${ids.length} scene${ids.length > 1 ? "s" : ""} moved to Boneyard`, "success"),
      }
    );
  };

  const restoreFromBoneyard = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    updateStatusMutation.mutate(
      { sceneIds: ids, status: "unscheduled" },
      {
        onSuccess: () => toast(`${ids.length} scene${ids.length > 1 ? "s" : ""} restored to Scriptyard`, "success"),
      }
    );
  };

  // Active filter count
  const activeFilters =
    (filterIE !== "all" ? 1 : 0) + (filterDN !== "all" ? 1 : 0);

  /* ── Loading state ─────────────────────────────────────── */
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div
          className="skeleton"
          style={{ width: 256, height: 32, borderRadius: "var(--radius-md)" }}
        />
      </div>
    );
  }

  /* ── Empty state ───────────────────────────────────────── */
  if (scenes.length === 0) {
    return (
      <div className="sf-empty">
        <MapPin
          size={48}
          strokeWidth={1.5}
          style={{ color: "var(--text-tertiary)", marginBottom: 20 }}
        />
        <h3 className="sf-empty-title">No scenes yet</h3>
        <p className="sf-empty-desc">
          Import a script to get started with your scene breakdown.
        </p>
        <button
          className="sf-btn sf-btn--primary"
          onClick={() => (window.location.href = `/projects/${id}/script`)}
        >
          Import Script
        </button>
      </div>
    );
  }

  /* ── Main render ───────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-6)",
          height: 48,
          flexShrink: 0,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        {/* Tabs */}
        <div className="sf-tabs" style={{ borderBottom: "none" }}>
          <button
            className={`sf-tab ${tab === "scriptyard" ? "is-active" : ""}`}
            onClick={() => { setTab("scriptyard"); setSelected(new Set()); }}
            title="Active scenes in your screenplay"
          >
            Scriptyard {scriptyardScenes.length}
          </button>
          <button
            className={`sf-tab ${tab === "boneyard" ? "is-active" : ""}`}
            onClick={() => { setTab("boneyard"); setSelected(new Set()); }}
            title="Scenes removed from the active schedule — stored here for reference or restoration"
          >
            Boneyard {boneyardScenes.length}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Sort dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className="sf-btn sf-btn--secondary sf-btn--sm"
              onClick={() => setSortOpen((o) => !o)}
              title="Sort"
            >
              <ArrowUpDown size={14} />
              <span style={{ marginLeft: 4 }}>Sort</span>
            </button>

            {sortOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: "var(--bg-surface-3)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-3)",
                  zIndex: 20,
                  minWidth: 180,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                {([
                  { key: "sceneNumber" as SortKey, label: "Scene Number" },
                  { key: "sceneName" as SortKey, label: "Location" },
                  { key: "pageCount" as SortKey, label: "Page Count" },
                  { key: "status" as SortKey, label: "Status" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSort(opt.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      color: sortKey === opt.key ? "var(--text-primary)" : "var(--text-secondary)",
                      background: sortKey === opt.key ? "var(--bg-surface-1)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{opt.label}</span>
                    {sortKey === opt.key && (
                      <span style={{ opacity: 0.5, fontSize: 12 }}>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button
              className="sf-btn sf-btn--secondary sf-btn--sm"
              onClick={() => setFilterOpen((o) => !o)}
              title="Filter"
              style={
                activeFilters > 0
                  ? {
                      borderColor: "var(--blue-border)",
                      background: "var(--blue-subtle)",
                    }
                  : undefined
              }
            >
              <Filter size={14} />
              <span style={{ marginLeft: 4 }}>
                Filter{activeFilters > 0 ? ` (${activeFilters})` : ""}
              </span>
            </button>

            {/* Filter dropdown */}
            {filterOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: "var(--bg-surface-3)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  zIndex: 20,
                  minWidth: 220,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  Interior / Exterior
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {(["all", "INT", "EXT"] as const).map((v) => (
                    <button
                      key={v}
                      className={`sf-chip ${filterIE === v ? "is-active" : ""}`}
                      onClick={() => setFilterIE(v)}
                    >
                      {v === "all" ? "All" : v}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  Day / Night
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["all", "DAY", "NIGHT"] as const).map((v) => (
                    <button
                      key={v}
                      className={`sf-chip ${filterDN === v ? "is-active" : ""}`}
                      onClick={() => setFilterDN(v)}
                    >
                      {v === "all" ? "All" : v}
                    </button>
                  ))}
                </div>
                {activeFilters > 0 && (
                  <button
                    className="sf-btn sf-btn--ghost sf-btn--sm"
                    style={{ marginTop: 12, width: "100%" }}
                    onClick={() => {
                      setFilterIE("all");
                      setFilterDN("all");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <button className="sf-btn sf-btn--secondary sf-btn--sm" title="Export">
            <Download size={14} />
            <span style={{ marginLeft: 4 }}>Export</span>
          </button>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border-default)",
              margin: "0 4px",
            }}
          />

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
              }}
            />
            <input
              className="sf-input"
              style={{
                height: 30,
                width: 200,
                fontSize: "var(--text-sm)",
                paddingLeft: 28,
              }}
              placeholder="Search scenes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Tab descriptions ──────────────────────────────── */}
      {tab === "boneyard" && boneyardScenes.length === 0 && (
        <div style={{
          padding: "24px var(--space-6)",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: "var(--text-sm)",
        }}>
          <Archive size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ marginBottom: 4, color: "var(--text-secondary)" }}>Boneyard is empty</p>
          <p>Scenes you remove from the active schedule are stored here. You can restore them at any time.</p>
        </div>
      )}

      {/* ── Summary bar ──────────────────────────────────── */}
      {(tab === "scriptyard" || filtered.length > 0) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 var(--space-6)",
            height: 32,
            flexShrink: 0,
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            gap: 16,
          }}
        >
          <span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {uniqueSceneCount}
            </span>{" "}
            scenes
          </span>
          <span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {totalPages.toFixed(1)}
            </span>{" "}
            pages
          </span>
          <span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
              {new Set(filtered.map((s) => s.sceneName)).size}
            </span>{" "}
            locations
          </span>
          {filtered.length !== activeScenes.length && (
            <span style={{ fontStyle: "italic" }}>
              (showing {filtered.length} of {activeScenes.length})
            </span>
          )}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="sf-table">
          <thead>
            <tr>
              <th style={{ width: 40, paddingLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  style={{ accentColor: "var(--blue)" }}
                />
              </th>
              <th
                style={{ width: 56, cursor: "pointer" }}
                onClick={() => handleSort("sceneNumber")}
              >
                #{" "}
                {sortKey === "sceneNumber" && (
                  <span style={{ opacity: 0.5 }}>
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </th>
              <th style={{ width: 56 }}>I/E</th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSort("sceneName")}
              >
                Set / Location{" "}
                {sortKey === "sceneName" && (
                  <span style={{ opacity: 0.5 }}>
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </th>
              <th style={{ width: 56 }}>D/N</th>
              <th style={{ width: 120 }}>Cast</th>
              <th
                style={{ width: 72, textAlign: "right", cursor: "pointer" }}
                onClick={() => handleSort("pageCount")}
              >
                Pages{" "}
                {sortKey === "pageCount" && (
                  <span style={{ opacity: 0.5 }}>
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </th>
              <th
                style={{ width: 100, cursor: "pointer" }}
                onClick={() => handleSort("status")}
              >
                Status{" "}
                {sortKey === "status" && (
                  <span style={{ opacity: 0.5 }}>
                    {sortDir === "asc" ? "\u2191" : "\u2193"}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((scene) => {
              const status = deriveStatus(scene);
              const warnings = tab === "scriptyard" ? getWarnings(scene) : [];
              const isSelected = selected.has(scene.id);
              const castNames =
                scene.castLinks?.map((c) => c.castMember.name) ?? [];
              const castDisplay =
                castNames.length <= 2
                  ? castNames.join(", ")
                  : `${castNames.slice(0, 2).join(", ")} +${castNames.length - 2}`;

              return (
                <React.Fragment key={scene.id}>
                  <tr
                    className={isSelected ? "is-selected" : ""}
                    style={{ height: 48, cursor: "pointer" }}
                    onClick={() =>
                      (window.location.href = `/projects/${id}/breakdown?scene=${scene.id}`)
                    }
                  >
                    <td
                      style={{ paddingLeft: 16 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(scene.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        style={{ accentColor: "var(--blue)" }}
                      />
                    </td>

                    {/* Scene # */}
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {scene.sceneNumber}
                    </td>

                    {/* I/E badge */}
                    <td>
                      {scene.intExt && (
                        <span
                          className={`sf-badge ${
                            scene.intExt === "EXT"
                              ? "sf-badge--ext"
                              : "sf-badge--int"
                          }`}
                        >
                          {scene.intExt}
                        </span>
                      )}
                    </td>

                    {/* Set / Location */}
                    <td
                      style={{
                        color: "var(--text-primary)",
                        maxWidth: 300,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {scene.sceneName || (
                        <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* D/N badge */}
                    <td>
                      {scene.dayNight && (
                        <span
                          className={`sf-badge ${
                            scene.dayNight === "NIGHT"
                              ? "sf-badge--night"
                              : "sf-badge--day"
                          }`}
                        >
                          {scene.dayNight}
                        </span>
                      )}
                    </td>

                    {/* Cast */}
                    <td
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {castDisplay || (
                        <span style={{ color: "var(--text-tertiary)" }}>&mdash;</span>
                      )}
                    </td>

                    {/* Pages */}
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-sm)",
                        textAlign: "right",
                        color: "var(--text-primary)",
                      }}
                    >
                      {scene.pageCount > 0 ? scene.pageCount.toFixed(1) : "\u2014"}
                    </td>

                    {/* Status badge */}
                    <td>
                      <span className={`sf-badge ${STATUS_BADGE[status]}`}>
                        {status}
                      </span>
                    </td>
                  </tr>

                  {/* Inline warnings for problem rows */}
                  {warnings.length > 0 && (
                    <tr style={{ height: "auto" }}>
                      <td
                        colSpan={8}
                        style={{ padding: 0, border: "none" }}
                      >
                        <div className="sf-inline-warning">
                          {warnings.map((w, i) => (
                            <span key={i}>
                              {"\u2514\u2500 \u26A0 "}
                              {w}
                              {i < warnings.length - 1 && (
                                <span style={{ margin: "0 8px", opacity: 0.4 }}>|</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

      </div>

      {/* ── Floating bulk action bar ─────────────────────── */}
      {selected.size > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 var(--space-6)",
            height: 52,
            flexShrink: 0,
            background: "var(--bg-surface-2)",
            borderTop: "1px solid var(--border-default)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {selected.size} selected
          </span>

          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border-default)",
            }}
          />

          {tab === "scriptyard" ? (
            <>
              <button className="sf-btn sf-btn--secondary sf-btn--sm">
                Assign Location
              </button>
              <button className="sf-btn sf-btn--secondary sf-btn--sm">
                Assign Unit
              </button>
              <button className="sf-btn sf-btn--secondary sf-btn--sm">
                Schedule
              </button>

              <div style={{ flex: 1 }} />

              <button
                className="sf-btn sf-btn--danger sf-btn--sm"
                onClick={moveToBoneyard}
                disabled={updateStatusMutation.isPending}
              >
                <Archive size={13} style={{ marginRight: 4 }} />
                Move to Boneyard
              </button>
            </>
          ) : (
            <>
              <button
                className="sf-btn sf-btn--primary sf-btn--sm"
                onClick={restoreFromBoneyard}
                disabled={updateStatusMutation.isPending}
              >
                <Undo2 size={13} style={{ marginRight: 4 }} />
                Restore to Scriptyard
              </button>

              <div style={{ flex: 1 }} />
            </>
          )}

          <button
            className="sf-btn sf-btn--ghost sf-btn--sm"
            onClick={() => setSelected(new Set())}
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
