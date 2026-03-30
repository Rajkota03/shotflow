"use client";

import React, { useState, useMemo, useCallback, use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ArrowUpDown,
  Filter,
  Download,
  MapPin,
  X,
} from "lucide-react";

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

function deriveStatus(s: Scene): "Ready" | "Incomplete" | "Scheduled" {
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

const STATUS_BADGE: Record<string, string> = {
  Ready: "sf-badge--green",
  Incomplete: "sf-badge--amber",
  Scheduled: "sf-badge--blue",
};

/* ── Component ─────────────────────────────────────────── */

export default function SceneListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // UI state
  const [tab, setTab] = useState<"scriptyard" | "boneyard">("scriptyard");
  const [sortKey, setSortKey] = useState<SortKey>("sceneNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterIE, setFilterIE] = useState<"all" | "INT" | "EXT">("all");
  const [filterDN, setFilterDN] = useState<"all" | "DAY" | "NIGHT">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Data
  const { data: scenes = [], isLoading } = useQuery<Scene[]>({
    queryKey: ["scenes", id],
    queryFn: () =>
      fetch(`/api/projects/${id}/scenes`).then((r) => r.json()),
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
    },
    [sortKey],
  );

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let list = [...scenes];

    if (filterIE !== "all") list = list.filter((s) => s.intExt === filterIE);
    if (filterDN !== "all") list = list.filter((s) => s.dayNight === filterDN);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.sceneName?.toLowerCase().includes(q) ||
          s.sceneNumber.includes(q) ||
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
          return (Number(a.sceneNumber) - Number(b.sceneNumber)) * dir;
      }
    });

    return list;
  }, [scenes, filterIE, filterDN, search, sortKey, sortDir]);

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
            onClick={() => setTab("scriptyard")}
          >
            Scriptyard {scenes.length}
          </button>
          <button
            className={`sf-tab ${tab === "boneyard" ? "is-active" : ""}`}
            onClick={() => setTab("boneyard")}
          >
            Boneyard 0
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="sf-btn sf-btn--secondary sf-btn--sm"
            onClick={() => handleSort(sortKey)}
            title="Sort"
          >
            <ArrowUpDown size={14} />
            <span style={{ marginLeft: 4 }}>Sort</span>
          </button>

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

      {/* ── Summary bar ──────────────────────────────────── */}
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
            {filtered.length}
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
      </div>

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
              const warnings = getWarnings(scene);
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
                      (window.location.href = `/projects/${id}/breakdown`)
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

          <button className="sf-btn sf-btn--danger sf-btn--sm">
            Move to Boneyard
          </button>

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
