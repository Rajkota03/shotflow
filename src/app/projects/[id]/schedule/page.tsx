"use client";

import { use, useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Moon,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  applySceneToDay,
  buildScheduleBoard,
  getScenePages,
  hydrateProjectWithBoard,
  serializeScheduleBoard,
} from "@/components/schedule/schedule-utils";
import type { ScheduleBoardState, ScheduleProject, ScheduleScene, ScheduleShootDay } from "@/components/schedule/types";
import { cn } from "@/lib/utils";
import { Stripboard } from "@/components/schedule/stripboard";
import "@/components/schedule/stripboard.css";

/* ── Call Sheet Presets (localStorage) ────────────── */

interface CallSheetPreset {
  id: string;
  name: string;
  callTime: string;
  wrapTime: string;
  color: string; // matte color for the call bar
}

const PRESET_COLORS = [
  { id: "amber",   label: "Amber",   value: "rgba(245, 166, 35, 0.18)",  border: "rgba(245, 166, 35, 0.35)",  text: "#e8a940" },
  { id: "blue",    label: "Blue",    value: "rgba(59, 130, 246, 0.15)",   border: "rgba(59, 130, 246, 0.30)",  text: "#6ba4f7" },
  { id: "teal",    label: "Teal",    value: "rgba(20, 184, 166, 0.14)",   border: "rgba(20, 184, 166, 0.28)",  text: "#3cc9b8" },
  { id: "violet",  label: "Violet",  value: "rgba(139, 92, 246, 0.15)",   border: "rgba(139, 92, 246, 0.28)",  text: "#a07ef5" },
  { id: "rose",    label: "Rose",    value: "rgba(244, 63, 94, 0.14)",    border: "rgba(244, 63, 94, 0.26)",   text: "#f06b85" },
  { id: "lime",    label: "Lime",    value: "rgba(132, 204, 22, 0.13)",   border: "rgba(132, 204, 22, 0.26)",  text: "#9bc23a" },
  { id: "slate",   label: "Slate",   value: "rgba(148, 163, 184, 0.12)",  border: "rgba(148, 163, 184, 0.22)", text: "#94a3b8" },
];

const DEFAULT_PRESETS: CallSheetPreset[] = [
  { id: "day-standard", name: "Day Call (Standard)", callTime: "06:00", wrapTime: "18:00", color: "amber" },
  { id: "day-late", name: "Day Call (Late)", callTime: "08:00", wrapTime: "20:00", color: "blue" },
  { id: "night-call", name: "Night Call", callTime: "18:00", wrapTime: "06:00", color: "violet" },
];

function getPresetColor(colorId: string) {
  return PRESET_COLORS.find((c) => c.id === colorId) || PRESET_COLORS[6]; // default slate
}

function loadPresets(): CallSheetPreset[] {
  if (typeof window === "undefined") return DEFAULT_PRESETS;
  try {
    const saved = localStorage.getItem("shotflow-call-presets");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old presets without color
      return parsed.map((p: CallSheetPreset) => ({ ...p, color: p.color || "slate" }));
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS;
}

function savePresets(presets: CallSheetPreset[]) {
  localStorage.setItem("shotflow-call-presets", JSON.stringify(presets));
}

// Per-day color mapping stored in localStorage
function loadDayColors(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("shotflow-day-colors");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveDayColors(colors: Record<string, string>) {
  localStorage.setItem("shotflow-day-colors", JSON.stringify(colors));
}

/* ── Helpers ──────────────────────────────────────── */

function getStripType(scene: ScheduleScene): string {
  const ie = scene.intExt?.toUpperCase() || "";
  const dn = scene.dayNight?.toUpperCase() || "";
  if (ie.includes("INT") && dn.includes("NIGHT")) return "int-night";
  if (ie.includes("EXT") && dn.includes("NIGHT")) return "ext-night";
  if (ie.includes("EXT")) return "ext-day";
  return "int-day";
}

function getDayTone(totalPages: number) {
  if (totalPages >= 8) return "critical";
  if (totalPages >= 6) return "busy";
  if (totalPages >= 3.5) return "steady";
  return "light";
}

function formatBoardDate(date: string | null) {
  if (!date) return { weekday: "TBD", stamp: "OPEN DATE" };
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return { weekday: "TBD", stamp: "OPEN DATE" };
  return {
    weekday: parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    stamp: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase(),
  };
}

/* ── Scene Strip (inside day columns) ─────────────── */
function SceneStrip({
  scene,
  isDragging = false,
  onRemove,
  conflicts,
}: {
  scene: ScheduleScene;
  isDragging?: boolean;
  onRemove?: () => void;
  conflicts?: string[];
}) {
  const stripType = getStripType(scene);
  const hasConflict = conflicts && conflicts.length > 0;

  return (
    <div className={cn("scene-strip", `scene-strip--${stripType}`, isDragging && "is-dragging", hasConflict && "scene-strip--conflict")}>
      <div className="scene-strip__row">
        <span className="scene-strip__title">Scene {scene.sceneNumber}</span>
        <span className="scene-strip__pages">{scene.pageCount.toFixed(1)}</span>
        {onRemove && (
          <button
            type="button"
            className="scene-strip__remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Unassign scene"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="scene-strip__meta">
        <span>{scene.intExt}</span>
        <span>{scene.dayNight}</span>
        {scene.sceneName && <span>{scene.sceneName.slice(0, 16)}</span>}
      </div>
      {hasConflict && (
        <div className="scene-strip__conflict" title={conflicts.join(", ")}>
          ⚠ {conflicts.join(", ")}
        </div>
      )}
    </div>
  );
}

function SortableStrip({
  scene,
  onRemove,
  conflicts,
}: {
  scene: ScheduleScene;
  onRemove?: () => void;
  conflicts?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className="relative"
      {...attributes}
      {...listeners}
    >
      <SceneStrip scene={scene} isDragging={isDragging} onRemove={onRemove} conflicts={conflicts} />
    </div>
  );
}

/* ── Call Time Popover (floating) ──────────────────── */
function CallTimePopover({
  callTime,
  wrapTime,
  dayNumber,
  anchorRect,
  presets,
  currentColor,
  onApply,
  onSavePreset,
  onClose,
}: {
  callTime: string;
  wrapTime: string;
  dayNumber: number;
  anchorRect: DOMRect | null;
  presets: CallSheetPreset[];
  currentColor: string;
  onApply: (callTime: string, wrapTime: string, colorId: string) => void;
  onSavePreset: (preset: CallSheetPreset) => void;
  onClose: () => void;
}) {
  const [call, setCall] = useState(callTime);
  const [wrap, setWrap] = useState(wrapTime);
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handlePreset = (p: CallSheetPreset) => {
    setCall(p.callTime);
    setWrap(p.wrapTime);
    setSelectedColor(p.color);
    onApply(p.callTime, p.wrapTime, p.color);
    onClose();
  };

  const handleSavePreset = () => {
    if (!saveName.trim()) return;
    onSavePreset({ id: `custom-${Date.now()}`, name: saveName.trim(), callTime: call, wrapTime: wrap, color: selectedColor });
    setSaveName("");
    setShowSave(false);
  };

  // Position: right of the anchor, or left if no space
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 100,
  };
  if (anchorRect) {
    const spaceRight = window.innerWidth - anchorRect.right;
    if (spaceRight > 260) {
      style.left = anchorRect.right + 6;
      style.top = anchorRect.top;
    } else {
      style.left = anchorRect.left - 246;
      style.top = anchorRect.top;
    }
    // Keep in viewport
    if ((style.top as number) + 380 > window.innerHeight) {
      style.top = Math.max(8, window.innerHeight - 390);
    }
  }

  return (
    <div ref={popoverRef} className="call-popover" style={style}>
      <div className="call-popover__header">
        <div>
          <div className="call-popover__title">Call Sheet Timing</div>
          <div className="call-popover__subtitle">Day {dayNumber}</div>
        </div>
        <button type="button" className="call-popover__close" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="call-popover__times">
        <label>
          <span>Call Time</span>
          <input type="time" value={call} onChange={(e) => setCall(e.target.value)} />
        </label>
        <label>
          <span>Wrap Time</span>
          <input type="time" value={wrap} onChange={(e) => setWrap(e.target.value)} />
        </label>
      </div>

      {/* Color picker */}
      <div className="call-popover__colors">
        <span className="call-popover__colors-label">Color</span>
        <div className="call-popover__color-row">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn("call-popover__color-dot", selectedColor === c.id && "is-active")}
              style={{ background: c.text }}
              onClick={() => setSelectedColor(c.id)}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="call-popover__actions">
        <button
          type="button"
          className="call-popover__apply"
          onClick={() => { onApply(call, wrap, selectedColor); onClose(); }}
        >
          Apply to Day {dayNumber}
        </button>
      </div>

      {presets.length > 0 && (
        <div className="call-popover__presets">
          <div className="call-popover__presets-label">Quick Presets</div>
          {presets.map((p) => (
            <button key={p.id} type="button" className="call-popover__preset" onClick={() => handlePreset(p)}>
              <span className="call-popover__preset-dot" style={{ background: getPresetColor(p.color).text }} />
              <span className="call-popover__preset-label">{p.name}</span>
              <span className="call-popover__preset-time">{p.callTime} — {p.wrapTime}</span>
            </button>
          ))}
        </div>
      )}

      <div className="call-popover__save-section">
        {showSave ? (
          <div className="call-popover__save-form">
            <input
              className="call-popover__save-input"
              placeholder="Preset name..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              autoFocus
            />
            <button type="button" className="call-popover__save-btn" onClick={handleSavePreset}>
              <Save size={11} />
            </button>
          </div>
        ) : (
          <button type="button" className="call-popover__save-trigger" onClick={() => setShowSave(true)}>
            <Plus size={11} />
            Save current as preset
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Day Column ───────────────────────────────────── */
function DayColumn({
  day,
  scenes,
  selected,
  onSelect,
  onRemoveScene,
  onDeleteDay,
  onUpdateCallTime,
  presets,
  onSavePreset,
  colorId,
  onColorChange,
  onReview,
  onUpdateDate,
  getConflicts,
}: {
  day: ScheduleShootDay;
  scenes: ScheduleScene[];
  selected: boolean;
  onSelect: () => void;
  onRemoveScene: (sceneId: string) => void;
  onDeleteDay: () => void;
  onUpdateCallTime: (callTime: string, wrapTime: string, colorId: string) => void;
  presets: CallSheetPreset[];
  onSavePreset: (preset: CallSheetPreset) => void;
  colorId: string;
  onColorChange: (colorId: string) => void;
  onReview: () => void;
  onUpdateDate: (date: string | null) => void;
  getConflicts: (scene: ScheduleScene, dayDate: string | null) => string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const [showCallPopover, setShowCallPopover] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const callTriggerRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const totalPages = getScenePages(scenes);
  const tone = getDayTone(totalPages);
  const isNight = day.dayType === "night_shoot";
  const date = formatBoardDate(day.date);
  const dominantLocation = scenes[0]?.sceneName || "No scenes yet";
  const uniqueLocations = new Set(scenes.map((s) => s.sceneName).filter(Boolean)).size;
  const callTime = day.callTime || "06:00";
  const wrapTime = day.estimatedWrap || "18:00";

  const openCallPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (callTriggerRef.current) {
      setAnchorRect(callTriggerRef.current.getBoundingClientRect());
    }
    setShowCallPopover(!showCallPopover);
  };

  return (
    <div
      className={cn(
        "day-column",
        `day-column--${tone}`,
        isNight && "day-column--night",
        selected && "is-selected",
      )}
    >
      <div className="day-column__header-wrap">
        <button
          type="button"
          className="day-column__delete"
          onClick={(e) => { e.stopPropagation(); onDeleteDay(); }}
          title="Delete this shoot day"
        >
          <Trash2 size={11} />
        </button>
        <button type="button" className="day-column__header" onClick={onSelect}>
          <div className="day-column__eyebrow">
            <span>DAY {day.dayNumber}</span>
            <span
              className="day-column__date-trigger"
              onClick={(e) => { e.stopPropagation(); dateInputRef.current?.showPicker(); }}
              title="Click to assign date"
            >
              {date.stamp}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              className="day-column__date-input"
              value={day.date ? day.date.split("T")[0] : ""}
              onChange={(e) => { e.stopPropagation(); onUpdateDate(e.target.value || null); }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="day-column__weekday">
            {date.weekday}
            {isNight && <Moon size={12} className="inline ml-1" style={{ color: "var(--amber)" }} />}
          </div>
          <div className="day-column__location">{dominantLocation}</div>
        </button>
        {/* Call time — color bar */}
        <button
          ref={callTriggerRef}
          type="button"
          className="day-column__call-trigger"
          style={{
            background: getPresetColor(colorId).value,
            borderColor: getPresetColor(colorId).border,
            color: getPresetColor(colorId).text,
          }}
          onClick={openCallPopover}
        >
          <Clock3 size={10} />
          <span>{callTime}</span>
          <span className="day-column__call-sep" style={{ color: getPresetColor(colorId).text, opacity: 0.4 }}>—</span>
          <span>{wrapTime}</span>
        </button>
        <div className="day-column__metrics">
          <span>{scenes.length} scenes</span>
          <span>{totalPages.toFixed(1)} pp</span>
          <span>{uniqueLocations} locs</span>
          <button
            type="button"
            className="day-column__review-btn"
            onClick={(e) => { e.stopPropagation(); onReview(); }}
            title="Review day details"
          >
            📋
          </button>
        </div>
      </div>

      {/* Floating popover via portal */}
      {showCallPopover && (
        <CallTimePopover
          callTime={callTime}
          wrapTime={wrapTime}
          dayNumber={day.dayNumber}
          anchorRect={anchorRect}
          presets={presets}
          currentColor={colorId}
          onApply={(c, w, color) => {
            onUpdateCallTime(c, w, color);
            onColorChange(color);
          }}
          onSavePreset={onSavePreset}
          onClose={() => setShowCallPopover(false)}
        />
      )}

      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn("day-column__body", isOver && "is-drop-target")}>
          {scenes.length === 0 ? (
            <button type="button" className="day-column__empty" onClick={onSelect}>
              <span>No scenes</span>
              <small>Click to add scenes</small>
            </button>
          ) : (
            scenes.map((scene) => (
              <SortableStrip key={scene.id} scene={scene} onRemove={() => onRemoveScene(scene.id)} conflicts={getConflicts(scene, day.date)} />
            ))
          )}
        </div>
      </SortableContext>

      <div className="day-column__footer">
        <span>
          <Clock3 size={12} />
          {callTime}
        </span>
        <span>{scenes.length > 0 ? `${totalPages.toFixed(1)}pp` : "Empty"}</span>
      </div>
    </div>
  );
}

/* ── Strip Drawer — Unscheduled scene picker with multi-select ── */
function StripDrawer({
  open,
  day,
  dayScenes,
  unscheduledScenes,
  onClose,
  onAssignScenes,
  onCollapsedClick,
}: {
  open: boolean;
  day: ScheduleShootDay | null;
  dayScenes: ScheduleScene[];
  unscheduledScenes: ScheduleScene[];
  onClose: () => void;
  onAssignScenes: (sceneIds: string[]) => void;
  onCollapsedClick: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "INT" | "EXT" | "NIGHT" | "DAY">("All");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterCast, setFilterCast] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const dayPages = dayScenes.reduce((s, sc) => s + sc.pageCount, 0);
  const date = day ? formatBoardDate(day.date) : null;

  // Unique locations and cast from unscheduled scenes
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    for (const s of unscheduledScenes) {
      if (s.sceneName) locs.add(s.sceneName);
    }
    return Array.from(locs).sort();
  }, [unscheduledScenes]);

  const uniqueCast = useMemo(() => {
    const cast = new Set<string>();
    for (const s of unscheduledScenes) {
      for (const link of s.castLinks || []) {
        if (link.castMember?.name) cast.add(link.castMember.name);
      }
    }
    return Array.from(cast).sort();
  }, [unscheduledScenes]);

  const filtered = useMemo(() => {
    return unscheduledScenes.filter((s) => {
      const matchSearch = !search || `${s.sceneNumber} ${s.sceneName}`.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "All" ||
        (filter === "INT" && s.intExt === "INT") ||
        (filter === "EXT" && s.intExt === "EXT") ||
        (filter === "NIGHT" && (s.dayNight === "NIGHT" || s.dayNight === "DUSK")) ||
        (filter === "DAY" && s.dayNight === "DAY");
      const matchLocation = filterLocation === "all" || s.sceneName === filterLocation;
      const matchCast = filterCast === "all" || (s.castLinks || []).some(
        (link) => link.castMember?.name === filterCast
      );
      return matchSearch && matchFilter && matchLocation && matchCast;
    });
  }, [unscheduledScenes, search, filter, filterLocation, filterCast]);

  const toggleScene = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onAssignScenes(Array.from(selected));
    setSelected(new Set());
  };

  const selectedPages = useMemo(() => {
    return unscheduledScenes
      .filter((s) => selected.has(s.id))
      .reduce((sum, s) => sum + s.pageCount, 0);
  }, [unscheduledScenes, selected]);

  return (
    <aside className={cn("strip-drawer", open && "is-open")}>
      {open && day ? (
        <>
          <div className="strip-drawer__header">
            <div>
              <div className="strip-drawer__eyebrow">DAY {day.dayNumber}</div>
              <h3>{date?.weekday || "TBD"}</h3>
              <p>{dayScenes.length} scenes · {dayPages.toFixed(1)} pp assigned</p>
            </div>
            <button type="button" className="strip-drawer__close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="strip-drawer__scroll">
            <div className="strip-drawer__search">
              <Search size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search unscheduled scenes..."
              />
            </div>

            <div className="strip-drawer__filter-row">
              {(["All", "INT", "EXT", "DAY", "NIGHT"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={cn("strip-drawer__filter", filter === f && "is-active")}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="strip-drawer__filter-row strip-drawer__filter-row--selects">
              {uniqueLocations.length > 1 && (
                <select
                  className="strip-drawer__select"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="all">All Locations</option>
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>{loc.length > 22 ? loc.slice(0, 22) + "…" : loc}</option>
                  ))}
                </select>
              )}
              {uniqueCast.length > 1 && (
                <select
                  className="strip-drawer__select"
                  value={filterCast}
                  onChange={(e) => setFilterCast(e.target.value)}
                >
                  <option value="all">All Cast</option>
                  {uniqueCast.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="strip-drawer__toolbar">
              <button type="button" className="strip-drawer__select-all" onClick={selectAll}>
                <div className={cn("strip-drawer__checkbox", selected.size === filtered.length && filtered.length > 0 && "is-checked")}>
                  {selected.size === filtered.length && filtered.length > 0 && <Check size={10} />}
                </div>
                <span>
                  {selected.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
                </span>
              </button>
              <span className="strip-drawer__scene-count">{filtered.length} scenes</span>
            </div>

            <div className="strip-drawer__pool">
              {filtered.length === 0 ? (
                <div className="strip-drawer__empty">
                  <span>No unscheduled scenes</span>
                  <small>All scenes have been assigned.</small>
                </div>
              ) : (
                filtered.map((scene) => {
                  const isSelected = selected.has(scene.id);
                  const stripType = getStripType(scene);
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      className={cn("strip-drawer__scene-row", isSelected && "is-selected")}
                      onClick={() => toggleScene(scene.id)}
                    >
                      <div className={cn("strip-drawer__checkbox", isSelected && "is-checked")}>
                        {isSelected && <Check size={10} />}
                      </div>
                      <div className={cn("strip-drawer__scene-info", `strip-drawer__scene-info--${stripType}`)}>
                        <div className="strip-drawer__scene-top">
                          <span className="strip-drawer__scene-num">Sc {scene.sceneNumber}</span>
                          <span className="strip-drawer__scene-pages">{scene.pageCount.toFixed(1)}</span>
                        </div>
                        <div className="strip-drawer__scene-bottom">
                          <span>{scene.intExt}</span>
                          <span>{scene.dayNight}</span>
                          <span>{scene.sceneName?.slice(0, 18)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="strip-drawer__confirm">
              <div className="strip-drawer__confirm-info">
                <strong>{selected.size}</strong> scenes · {selectedPages.toFixed(1)} pp
              </div>
              <button type="button" className="strip-drawer__confirm-btn" onClick={handleConfirm}>
                <Check size={14} />
                Assign to Day {day.dayNumber}
              </button>
            </div>
          )}
        </>
      ) : (
        <button type="button" className="strip-drawer__collapsed" onClick={onCollapsedClick}>
          <div className="strip-drawer__collapsed-copy">
            <span>SCENE BANK</span>
            <strong>{unscheduledScenes.length}</strong>
            <small>Click to open</small>
          </div>
        </button>
      )}
    </aside>
  );
}

/* ── Schedule Setup Modal ─────────────────────────── */
function ScheduleSetupModal({
  projectId,
  presets,
  onCreated,
  onClose,
}: {
  projectId: string;
  presets: CallSheetPreset[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("Main Schedule");
  const [mode, setMode] = useState<"days" | "dates">("days");
  const [numberOfDays, setNumberOfDays] = useState("10");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0]?.id || "");
  const [blockedWeekdays, setBlockedWeekdays] = useState<number[]>([0]);
  const [creating, setCreating] = useState(false);

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleBlockedDay = (dayIdx: number) => {
    setBlockedWeekdays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const preset = presets.find((p) => p.id === selectedPreset);

  const handleCreate = async () => {
    if (mode === "days" && (!numberOfDays || Number(numberOfDays) < 1)) {
      toast("Enter the number of shoot days", "warning");
      return;
    }
    if (mode === "dates" && (!startDate || !endDate)) {
      toast("Please set both start and end dates", "warning");
      return;
    }
    setCreating(true);
    try {
      const body = mode === "days"
        ? { name, numberOfDays: Number(numberOfDays) }
        : { name, startDate, endDate, blockedWeekdays };

      const res = await fetch(`/api/projects/${projectId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");

      if (preset) {
        const schedule = await res.json();
        const shootDays = schedule.shootDays || [];
        await Promise.all(
          shootDays.map((day: { id: string }) =>
            fetch(`/api/projects/${projectId}/shoot-days/${day.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callTime: preset.callTime, estimatedWrap: preset.wrapTime }),
            })
          )
        );
      }

      toast("Schedule created", "success");
      onCreated();
    } catch {
      toast("Failed to create schedule", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="ai-modal__eyebrow">New Schedule</div>
        <h3 style={{ fontSize: 22 }}>Schedule Setup</h3>
        <p>Set the number of shoot days first. You can assign calendar dates later.</p>

        <div className="setup-modal__form">
          {/* Name */}
          <div className="setup-modal__field">
            <label>Schedule Name</label>
            <input
              className="sf-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main Schedule"
            />
          </div>

          {/* Mode toggle */}
          <div className="setup-modal__field">
            <label>How do you want to set up days?</label>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                type="button"
                className={cn("setup-modal__weekday", mode === "days" && "is-blocked")}
                style={{ flex: 1, padding: "8px 12px", fontSize: 12 }}
                onClick={() => setMode("days")}
              >
                Number of Days
              </button>
              <button
                type="button"
                className={cn("setup-modal__weekday", mode === "dates" && "is-blocked")}
                style={{ flex: 1, padding: "8px 12px", fontSize: 12 }}
                onClick={() => setMode("dates")}
              >
                Date Range
              </button>
            </div>
          </div>

          {mode === "days" ? (
            <div className="setup-modal__field">
              <label>Number of Shoot Days</label>
              <input
                className="sf-input"
                type="number"
                min={1}
                max={100}
                value={numberOfDays}
                onChange={(e) => setNumberOfDays(e.target.value)}
                placeholder="10"
                style={{ maxWidth: 120 }}
              />
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, display: "block" }}>
                Days will be created without dates. Assign calendar dates from the schedule board.
              </span>
            </div>
          ) : (
            <>
              <div className="setup-modal__row">
                <div className="setup-modal__field">
                  <label>Start Date</label>
                  <input className="sf-date-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="setup-modal__field">
                  <label>End Date</label>
                  <input className="sf-date-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="setup-modal__field">
                <label>Off Days</label>
                <div className="setup-modal__weekdays">
                  {WEEKDAYS.map((day, i) => (
                    <button key={day} type="button" className={cn("setup-modal__weekday", blockedWeekdays.includes(i) && "is-blocked")} onClick={() => toggleBlockedDay(i)}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Call Sheet Preset */}
          <div className="setup-modal__field">
            <label>Call Sheet Timing</label>
            <div className="setup-modal__presets">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn("setup-modal__preset", selectedPreset === p.id && "is-active")}
                  onClick={() => setSelectedPreset(p.id)}
                >
                  <span className="setup-modal__preset-name">{p.name}</span>
                  <span className="setup-modal__preset-time">{p.callTime} — {p.wrapTime}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ai-modal__footer">
          <button type="button" className="sf-btn sf-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sf-btn sf-btn--primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating..." : `Create ${mode === "days" ? numberOfDays : ""} Shoot Days`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Call Sheet Presets Manager Modal ──────────────── */
function PresetsModal({
  presets,
  onSave,
  onClose,
}: {
  presets: CallSheetPreset[];
  onSave: (presets: CallSheetPreset[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CallSheetPreset[]>([...presets]);
  const [newName, setNewName] = useState("");
  const [newCall, setNewCall] = useState("06:00");
  const [newWrap, setNewWrap] = useState("18:00");

  const addPreset = () => {
    if (!newName.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name: newName.trim(), callTime: newCall, wrapTime: newWrap, color: "slate" },
    ]);
    setNewName("");
    setNewCall("06:00");
    setNewWrap("18:00");
  };

  const removePreset = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="ai-modal__eyebrow">Settings</div>
        <h3 style={{ fontSize: 22 }}>Call Sheet Presets</h3>
        <p>Create and manage reusable call/wrap timing templates.</p>

        <div className="presets-modal__list">
          {items.map((p) => (
            <div key={p.id} className="presets-modal__item">
              <div>
                <div className="presets-modal__item-name">{p.name}</div>
                <div className="presets-modal__item-time">{p.callTime} — {p.wrapTime}</div>
              </div>
              <button type="button" className="presets-modal__delete" onClick={() => removePreset(p.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="presets-modal__add">
          <input
            className="sf-input"
            placeholder="Preset name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <input type="time" className="sf-input" value={newCall} onChange={(e) => setNewCall(e.target.value)} style={{ width: 100 }} />
          <input type="time" className="sf-input" value={newWrap} onChange={(e) => setNewWrap(e.target.value)} style={{ width: 100 }} />
          <button type="button" className="sf-btn sf-btn--ghost sf-btn--icon-sm" onClick={addPreset}>
            <Plus size={16} />
          </button>
        </div>

        <div className="ai-modal__footer">
          <button type="button" className="sf-btn sf-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sf-btn sf-btn--primary" onClick={() => { onSave(items); onClose(); }}>
            <Save size={14} />
            Save Presets
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AI Fill Modal ─────────────────────────────────── */
function AIFillModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (maxPages: number, priority: string) => void;
}) {
  const [maxPages, setMaxPages] = useState(6);
  const [priority, setPriority] = useState("location");

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal__eyebrow">AI Fill</div>
        <h3>Balance the board automatically</h3>
        <p>Use the current scene pool to rough in a first pass across the calendar, then fine-tune by hand.</p>

        <div className="ai-modal__section">
          <span>Pages per day</span>
          <div className="ai-modal__chips">
            {[4, 5, 6, 7, 8].map((pp) => (
              <button
                key={pp}
                type="button"
                className={cn("ai-modal__chip", maxPages === pp && "is-active")}
                onClick={() => setMaxPages(pp)}
              >
                {pp} pp
              </button>
            ))}
          </div>
        </div>

        <div className="ai-modal__section">
          <span>Priority</span>
          <div className="ai-modal__chips ai-modal__chips--stacked">
            {[
              { label: "Group by location", value: "location" },
              { label: "Minimize cast hold", value: "cast" },
              { label: "Follow script order", value: "script_order" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn("ai-modal__chip", priority === opt.value && "is-active")}
                onClick={() => setPriority(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-modal__footer">
          <button type="button" className="sf-btn sf-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sf-btn sf-btn--primary" onClick={() => onApply(maxPages, priority)}>
            Apply AI Fill
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [workingBoard, setWorkingBoard] = useState<ScheduleBoardState | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [reviewDayId, setReviewDayId] = useState<string | null>(null);
  const [presets, setPresets] = useState<CallSheetPreset[]>(DEFAULT_PRESETS);
  const [viewMode, setViewMode] = useState<"board" | "stripboard">("board");
  const [dayColors, setDayColors] = useState<Record<string, string>>({});
  const boardSnapshotRef = useRef<ScheduleBoardState | null>(null);

  // Load presets and day colors from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets());
    setDayColors(loadDayColors());
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: project, isLoading } = useQuery<ScheduleProject>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const serverBoard = useMemo(
    () => (project ? buildScheduleBoard(project) : { unscheduled: [] }),
    [project]
  );

  // Auto-show setup modal if no shoot days exist
  const hasShownSetup = useRef(false);
  useEffect(() => {
    if (project && !isLoading && (project.shootDays?.length ?? 0) === 0 && !hasShownSetup.current) {
      hasShownSetup.current = true;
      setShowSetupModal(true);
    }
  }, [project, isLoading]);

  const reorderMutation = useMutation({
    mutationFn: async (nextBoard: ScheduleBoardState) => {
      const updates = serializeScheduleBoard(nextBoard, project?.shootDays ?? []);
      const res = await fetch(`/api/projects/${id}/schedule/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error("Failed to persist");
    },
    onMutate: async (nextBoard) => {
      await qc.cancelQueries({ queryKey: ["project", id] });
      const prev = qc.getQueryData<ScheduleProject>(["project", id]);
      if (prev) qc.setQueryData<ScheduleProject>(["project", id], hydrateProjectWithBoard(prev, nextBoard));
      return { prev };
    },
    onSuccess: () => { setWorkingBoard(null); qc.invalidateQueries({ queryKey: ["project", id] }); },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["project", id], ctx.prev);
      setWorkingBoard(null);
      toast("Could not save schedule changes", "error");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const addDayMutation = useMutation({
    mutationFn: async () => {
      const nextNum = (project?.shootDays.length ?? 0) + 1;
      const res = await fetch(`/api/projects/${id}/shoot-days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber: nextNum, dayType: "full" }),
      });
      if (!res.ok) throw new Error("Unable to add shoot day");
      return res.json();
    },
    onSuccess: (newDay) => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast("Shoot day added", "success");
      if (newDay?.id) setSelectedDayId(newDay.id);
    },
    onError: () => toast("Unable to add shoot day", "error"),
  });

  const updateDayDateMutation = useMutation({
    mutationFn: async ({ dayId, date }: { dayId: string; date: string | null }) => {
      const res = await fetch(`/api/projects/${id}/shoot-days/${dayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error("Failed to update date");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); },
    onError: () => toast("Failed to update date", "error"),
  });

  const updateDayTimeMutation = useMutation({
    mutationFn: async ({ dayId, callTime, wrapTime }: { dayId: string; callTime: string; wrapTime: string }) => {
      const body: Record<string, string> = {};
      if (callTime) body.callTime = callTime;
      if (wrapTime) body.estimatedWrap = wrapTime;
      const res = await fetch(`/api/projects/${id}/shoot-days/${dayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const res = await fetch(`/api/projects/${id}/shoot-days/${dayId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      setSelectedDayId(null);
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast("Shoot day deleted", "success");
    },
    onError: () => toast("Failed to delete shoot day", "error"),
  });

  const days = project?.shootDays ?? [];
  const board = workingBoard ?? serverBoard;
  const unscheduledScenes = board.unscheduled ?? [];
  const allScenes = useMemo(() => Object.values(board).flat(), [board]);
  const scheduledCount = allScenes.length - unscheduledScenes.length;
  const scheduledPages = useMemo(() => {
    return days.reduce((sum, day) => sum + getScenePages(board[day.id] ?? []), 0);
  }, [days, board]);
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;
  const selectedDayScenes = selectedDay ? (board[selectedDay.id] ?? []) : [];
  const activeScene = allScenes.find((s) => s.id === activeSceneId) ?? null;
  const reviewDay = reviewDayId ? days.find((d) => d.id === reviewDayId) ?? null : null;
  const reviewDayScenes = reviewDay ? (board[reviewDay.id] ?? []) : [];

  // Cast availability conflict detection
  const getSceneConflicts = useCallback((scene: ScheduleScene, dayDate: string | null): string[] => {
    if (!dayDate) return [];
    const dateStr = dayDate.split("T")[0]; // normalize to YYYY-MM-DD
    const conflicts: string[] = [];
    for (const link of scene.castLinks || []) {
      const cm = link.castMember;
      if (!cm?.availableDates) continue;
      try {
        const available: string[] = JSON.parse(cm.availableDates);
        if (available.length > 0 && !available.includes(dateStr)) {
          conflicts.push(`${cm.characterName || cm.name} unavailable`);
        }
      } catch { /* skip */ }
    }
    return conflicts;
  }, []);

  function findContainer(sceneIdOrContainerId: string, b: ScheduleBoardState) {
    if (sceneIdOrContainerId in b) return sceneIdOrContainerId;
    return Object.keys(b).find((key) => b[key]?.some((s) => s.id === sceneIdOrContainerId));
  }

  function persistBoard(next: ScheduleBoardState) { reorderMutation.mutate(next); }

  function handleDragStart(e: DragStartEvent) {
    boardSnapshotRef.current = board;
    setActiveSceneId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const activeId = e.active.id as string;
    const activeCont = findContainer(activeId, board);
    const overCont = findContainer(overId, board);
    if (!activeCont || !overCont || activeCont === overCont) return;

    setWorkingBoard((curr) => {
      const c = curr ?? board;
      const src = c[activeCont];
      const tgt = c[overCont];
      const srcIdx = src.findIndex((s) => s.id === activeId);
      if (srcIdx === -1) return c;

      const moving = src[srcIdx];
      const nextSrc = src.filter((s) => s.id !== activeId);
      const overIdx = tgt.findIndex((s) => s.id === overId);
      const insertIdx = overId in c ? tgt.length : overIdx >= 0 ? overIdx : tgt.length;
      const nextTgt = [...tgt];
      nextTgt.splice(insertIdx, 0, { ...moving, shootDayId: overCont === "unscheduled" ? null : overCont });

      return { ...c, [activeCont]: nextSrc, [overCont]: nextTgt };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as string | undefined;
    if (!overId) {
      if (boardSnapshotRef.current) setWorkingBoard(boardSnapshotRef.current);
      setActiveSceneId(null);
      return;
    }

    const activeId = e.active.id as string;
    const containerId = findContainer(activeId, board);
    const overContainer = findContainer(overId, board);

    if (!containerId || !overContainer) { setActiveSceneId(null); return; }

    const activeIdx = board[containerId].findIndex((s) => s.id === activeId);
    const overIdx = board[overContainer].findIndex((s) => s.id === overId);

    let next = board;
    if (containerId === overContainer && activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
      next = { ...board, [containerId]: arrayMove(board[containerId], activeIdx, overIdx) };
      setWorkingBoard(next);
    }

    setActiveSceneId(null);
    persistBoard(next);
  }

  const handleAssignScenes = useCallback((sceneIds: string[]) => {
    if (!selectedDay) return;
    let next = board;
    for (const sceneId of sceneIds) {
      next = applySceneToDay(next, sceneId, selectedDay.id);
    }
    setWorkingBoard(next);
    persistBoard(next);
    toast(`${sceneIds.length} scene${sceneIds.length > 1 ? "s" : ""} assigned to Day ${selectedDay.dayNumber}`, "success");
  }, [board, selectedDay, toast]);

  const handleRemoveScene = useCallback((sceneId: string) => {
    const next = applySceneToDay(board, sceneId, "unscheduled");
    setWorkingBoard(next);
    persistBoard(next);
  }, [board]);

  const handleSavePresets = (newPresets: CallSheetPreset[]) => {
    setPresets(newPresets);
    savePresets(newPresets);
    toast("Call sheet presets saved", "success");
  };

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats top bar */}
      <div className="schedule-topbar">
        <div className="schedule-topbar__left">
          <div className="schedule-topbar__title">Production Schedule</div>
          <div className="schedule-view-toggle">
            <button
              type="button"
              className={cn("schedule-view-toggle__btn", viewMode === "board" && "is-active")}
              onClick={() => setViewMode("board")}
            >
              <LayoutGrid size={13} />
              Board
            </button>
            <button
              type="button"
              className={cn("schedule-view-toggle__btn", viewMode === "stripboard" && "is-active")}
              onClick={() => setViewMode("stripboard")}
            >
              <List size={13} />
              Stripboard
            </button>
          </div>
        </div>
        <div className="schedule-topbar__stats">
          <div className="schedule-stat">
            <div className="schedule-stat__number">{allScenes.length}</div>
            <div className="schedule-stat__label">Scenes</div>
          </div>
          <div className="schedule-stat">
            <div className="schedule-stat__number">{scheduledCount}</div>
            <div className="schedule-stat__label">Scheduled</div>
          </div>
          <div className="schedule-stat">
            <div className="schedule-stat__number">{days.length}</div>
            <div className="schedule-stat__label">Shoot Days</div>
          </div>
          <div className="schedule-stat">
            <div className="schedule-stat__number">{unscheduledScenes.length}</div>
            <div className="schedule-stat__label">Unscheduled</div>
          </div>
          <div className="schedule-stat">
            <div className="schedule-stat__number">{scheduledPages.toFixed(1)}</div>
            <div className="schedule-stat__label">Pages Placed</div>
          </div>
        </div>
      </div>

      {/* Subbar (board view only) */}
      {viewMode === "board" && (
        <div className="schedule-subbar">
        <div className="schedule-subbar__meta">
          <button
            className="sf-btn sf-btn--ghost sf-btn--icon-sm"
            onClick={() => {
              if (days.length === 0) return;
              if (!selectedDay) { setSelectedDayId(days[days.length - 1]?.id ?? null); return; }
              const idx = days.findIndex((d) => d.id === selectedDay.id);
              setSelectedDayId(days[Math.max(0, idx - 1)]?.id ?? null);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="schedule-subbar__label">
            {selectedDay
              ? `Day ${selectedDay.dayNumber} — ${formatBoardDate(selectedDay.date).weekday}`
              : "Select a day to assign scenes"}
          </span>
          <button
            className="sf-btn sf-btn--ghost sf-btn--icon-sm"
            onClick={() => {
              if (days.length === 0) return;
              if (!selectedDay) { setSelectedDayId(days[0]?.id ?? null); return; }
              const idx = days.findIndex((d) => d.id === selectedDay.id);
              setSelectedDayId(days[Math.min(days.length - 1, idx + 1)]?.id ?? null);
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="schedule-subbar__actions">
          <button type="button" className="schedule-action" onClick={() => setShowAIModal(true)}>
            <Sparkles size={14} />
            AI Fill
          </button>
          <button type="button" className="schedule-action" onClick={() => setShowPresetsModal(true)}>
            <Clock3 size={14} />
            Call Presets
          </button>
          <button type="button" className="schedule-action" onClick={() => setShowSetupModal(true)}>
            <Settings2 size={14} />
            Setup
          </button>
          <button
            type="button"
            className="schedule-action schedule-action--primary"
            onClick={() => addDayMutation.mutate()}
            disabled={addDayMutation.isPending}
          >
            <CalendarPlus size={14} />
            Add Day
          </button>
        </div>
      </div>
      )}

      {/* Stripboard view */}
      {viewMode === "stripboard" && (
        <Stripboard
          board={board}
          shootDays={days}
          onBoardChange={(nextBoard) => {
            setWorkingBoard(nextBoard);
            persistBoard(nextBoard);
          }}
        />
      )}

      {/* Board view */}
      {viewMode === "board" && (
        <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="schedule-board">
          <div className="schedule-grid">
            {days.length === 0 ? (
              <div className="schedule-empty">
                <div className="schedule-empty__title">No shoot days yet</div>
                <p className="schedule-empty__text">Set up your schedule to start assigning scenes to shoot days.</p>
                <button
                  className="sf-btn sf-btn--primary"
                  onClick={() => setShowSetupModal(true)}
                >
                  <Settings2 size={16} />
                  Setup Schedule
                </button>
              </div>
            ) : (
              <div className="schedule-grid__inner">
                {days.map((day) => (
                  <DayColumn
                    key={day.id}
                    day={day}
                    scenes={board[day.id] ?? []}
                    selected={selectedDayId === day.id}
                    onSelect={() => setSelectedDayId(day.id)}
                    onRemoveScene={handleRemoveScene}
                    onDeleteDay={() => {
                      if (confirm(`Delete Day ${day.dayNumber}? Scenes will be unscheduled.`)) {
                        deleteDayMutation.mutate(day.id);
                      }
                    }}
                    onUpdateCallTime={(callTime, wrapTime, colorId) => {
                      updateDayTimeMutation.mutate({ dayId: day.id, callTime, wrapTime });
                      if (colorId) {
                        const next = { ...dayColors, [day.id]: colorId };
                        setDayColors(next);
                        saveDayColors(next);
                      }
                    }}
                    presets={presets}
                    onSavePreset={(preset) => {
                      const next = [...presets, preset];
                      setPresets(next);
                      savePresets(next);
                      toast(`Preset "${preset.name}" saved`, "success");
                    }}
                    colorId={dayColors[day.id] || "amber"}
                    onColorChange={(colorId) => {
                      const next = { ...dayColors, [day.id]: colorId };
                      setDayColors(next);
                      saveDayColors(next);
                    }}
                    onReview={() => setReviewDayId(day.id)}
                    onUpdateDate={(date) => updateDayDateMutation.mutate({ dayId: day.id, date })}
                    getConflicts={getSceneConflicts}
                  />
                ))}
              </div>
            )}
          </div>

          <StripDrawer
            open={!!selectedDay}
            day={selectedDay}
            dayScenes={selectedDayScenes}
            unscheduledScenes={unscheduledScenes}
            onClose={() => setSelectedDayId(null)}
            onAssignScenes={handleAssignScenes}
            onCollapsedClick={() => {
              if (days.length > 0) setSelectedDayId(days[0].id);
            }}
          />
        </div>

        <DragOverlay>
          {activeScene ? <SceneStrip scene={activeScene} isDragging /> : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Modals */}
      {showAIModal && (
        <AIFillModal
          onClose={() => setShowAIModal(false)}
          onApply={(maxPages, priority) => {
            setShowAIModal(false);
            toast(`AI Fill applied: ${maxPages}pp/day, ${priority} priority`, "success");
          }}
        />
      )}

      {showSetupModal && (
        <ScheduleSetupModal
          projectId={id}
          presets={presets}
          onCreated={() => {
            setShowSetupModal(false);
            qc.invalidateQueries({ queryKey: ["project", id] });
          }}
          onClose={() => setShowSetupModal(false)}
        />
      )}

      {showPresetsModal && (
        <PresetsModal
          presets={presets}
          onSave={handleSavePresets}
          onClose={() => setShowPresetsModal(false)}
        />
      )}

      {reviewDay && (
        <DayReviewModal
          day={reviewDay}
          scenes={reviewDayScenes}
          colorId={dayColors[reviewDay.id] || "amber"}
          getConflicts={getSceneConflicts}
          onClose={() => setReviewDayId(null)}
        />
      )}
    </div>
  );
}

/* ── Day Review Modal ──────────────────────────────── */

function DayReviewModal({
  day,
  scenes,
  colorId,
  getConflicts,
  onClose,
}: {
  day: ScheduleShootDay;
  scenes: ScheduleScene[];
  colorId: string;
  getConflicts: (scene: ScheduleScene, dayDate: string | null) => string[];
  onClose: () => void;
}) {
  const date = formatBoardDate(day.date);
  const totalPages = getScenePages(scenes);
  const tone = getDayTone(totalPages);
  const presetColor = getPresetColor(colorId);

  // Collect all unique cast for this day
  const dayCast = new Map<string, { name: string; character: string | null; conflicts: boolean }>();
  for (const scene of scenes) {
    const conflicts = getConflicts(scene, day.date);
    for (const link of scene.castLinks || []) {
      const cm = link.castMember;
      if (cm && !dayCast.has(cm.name)) {
        const hasConflict = conflicts.some((c) => c.includes(cm.characterName || cm.name));
        dayCast.set(cm.name, { name: cm.name, character: cm.characterName || null, conflicts: hasConflict });
      }
    }
  }

  // Unique locations
  const locations = [...new Set(scenes.map((s) => s.sceneName).filter(Boolean))];

  // Total conflicts
  const totalConflicts = scenes.reduce((sum, s) => sum + getConflicts(s, day.date).length, 0);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderRadius: 16, padding: 0, width: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>
                DAY {day.dayNumber} · {date.stamp}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>
                {date.weekday}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>

          {/* Metrics row */}
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ padding: "6px 12px", borderRadius: 8, background: presetColor.value, border: `1px solid ${presetColor.border}`, fontSize: 11, color: presetColor.text }}>
              🕐 {day.callTime || "06:00"} — {day.estimatedWrap || "18:00"}
            </div>
            <div style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-surface-3)", fontSize: 11, color: "var(--text-secondary)" }}>
              {scenes.length} scenes · {totalPages.toFixed(1)} pages
            </div>
            {totalConflicts > 0 && (
              <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 11, color: "#ef4444" }}>
                ⚠ {totalConflicts} conflict{totalConflicts !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {/* Scenes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Scenes ({scenes.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scenes.map((scene) => {
                const conflicts = getConflicts(scene, day.date);
                const stripType = getStripType(scene);
                return (
                  <div key={scene.id} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: conflicts.length > 0 ? "rgba(239,68,68,0.06)" : "var(--bg-surface-3)",
                    border: `1px solid ${conflicts.length > 0 ? "rgba(239,68,68,0.2)" : "var(--border-subtle)"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Sc {scene.sceneNumber}</span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{scene.intExt} · {scene.dayNight}</span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{scene.pageCount.toFixed(1)}pp</span>
                      </div>
                    </div>
                    {scene.sceneName && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{scene.sceneName}</div>
                    )}
                    {/* Cast in scene */}
                    {scene.castLinks?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {scene.castLinks.map((link, i) => {
                          const isUnavailable = conflicts.some((c) => c.includes(link.castMember?.characterName || link.castMember?.name || ""));
                          return (
                            <span key={i} style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: isUnavailable ? "rgba(239,68,68,0.15)" : "var(--bg-surface-1)",
                              color: isUnavailable ? "#ef4444" : "var(--text-secondary)",
                              border: isUnavailable ? "1px solid rgba(239,68,68,0.3)" : "none",
                            }}>
                              {link.castMember?.characterName || link.castMember?.name}
                              {isUnavailable && " ⚠"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {conflicts.length > 0 && (
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                        ⚠ {conflicts.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {scenes.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                  No scenes assigned to this day.
                </div>
              )}
            </div>
          </div>

          {/* Locations */}
          {locations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 8 }}>
                Locations ({locations.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {locations.map((loc) => (
                  <span key={loc} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-surface-3)", color: "var(--text-secondary)" }}>
                    📍 {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cast */}
          {dayCast.size > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 8 }}>
                Cast on Set ({dayCast.size})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Array.from(dayCast.values()).map((cm) => (
                  <div key={cm.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 10px", borderRadius: 6,
                    background: cm.conflicts ? "rgba(239,68,68,0.06)" : "var(--bg-surface-3)",
                    border: cm.conflicts ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent",
                  }}>
                    <div>
                      <span style={{ fontSize: 12, color: cm.conflicts ? "#ef4444" : "var(--text-primary)" }}>{cm.name}</span>
                      {cm.character && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>as {cm.character}</span>}
                    </div>
                    {cm.conflicts && <span style={{ fontSize: 10, color: "#ef4444" }}>⚠ Unavailable</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
