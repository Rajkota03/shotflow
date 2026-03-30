"use client";
import "./breakdown.css";
import { useState, useCallback, use, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  X,
  Check,
  Trash2,
  ListChecks,
  Pencil,
  BrainCircuit,
  AlertOctagon,
  Loader2,
  Wand2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────── */

interface SceneElement {
  name: string;
  category: string;
  source: string;
  status: string;
  confidence?: number;
  id?: string;
}

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  synopsis: string | null;
  content: string | null;
  status: string;
  elementsJson?: string | null;
  castLinks?: { castMember: { name: string; characterName: string } }[];
}

const CATEGORIES = [
  { key: "cast", label: "Cast", color: "var(--cat-cast)" },
  { key: "extras", label: "Extras", color: "var(--cat-extras)" },
  { key: "props", label: "Props", color: "var(--cat-props)" },
  { key: "wardrobe", label: "Wardrobe", color: "var(--cat-wardrobe)" },
  { key: "vfx", label: "VFX", color: "var(--cat-vfx)" },
  { key: "makeup", label: "Makeup", color: "var(--cat-makeup)" },
  { key: "locations", label: "Locations", color: "var(--cat-locations)" },
  { key: "stunts", label: "Stunts", color: "var(--cat-stunts)" },
  { key: "vehicles", label: "Vehicles", color: "var(--cat-vehicles)" },
  { key: "equipment", label: "Equipment", color: "var(--cat-equipment)" },
] as const;

/* ── Helpers ────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getElements(scene: Scene): SceneElement[] {
  const elements: SceneElement[] = [];

  if (scene.castLinks?.length) {
    scene.castLinks.forEach((l) => {
      elements.push({
        id: uid(),
        name: l.castMember.characterName || l.castMember.name,
        category: "cast",
        source: "linked",
        status: "accepted",
      });
    });
  }

  if (scene.elementsJson) {
    try {
      const parsed = JSON.parse(scene.elementsJson);
      parsed.forEach((e: SceneElement) => {
        elements.push({
          id: e.id || uid(),
          name: e.name,
          category: (e.category || "").toLowerCase(),
          source: e.source || "manual",
          status: e.status || "accepted",
          confidence: e.confidence,
        });
      });
    } catch { /* ignore */ }
  }

  return elements;
}

function groupByCategory(elements: SceneElement[]): Record<string, SceneElement[]> {
  const grouped: Record<string, SceneElement[]> = {};
  CATEGORIES.forEach((c) => (grouped[c.key] = []));
  elements.forEach((el) => {
    const cat = el.category?.toLowerCase();
    if (grouped[cat]) grouped[cat].push(el);
  });
  return grouped;
}

/* ── Page ───────────────────────────────────────── */

export default function BreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [editingEl, setEditingEl] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    running: boolean;
    processed: number;
    total: number;
    currentScene: string;
    totalAdded: number;
  } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const { data: scenes = [], isLoading } = useQuery<Scene[]>({
    queryKey: ["scenes", id],
    queryFn: () => fetch(`/api/projects/${id}/scenes`).then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sceneId, elementsJson }: { sceneId: string; elementsJson: string }) => {
      const res = await fetch(`/api/projects/${id}/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elementsJson }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", id] }),
  });

  /* ── AI Mutations ─────────────────────────────── */

  const aiBreakdownMutation = useMutation({
    mutationFn: async (sceneId: string) => {
      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, projectId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI breakdown failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["scenes", id] });
      toast(`AI found ${data.added} new element${data.added !== 1 ? "s" : ""}`, "success");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  const aiSynopsisMutation = useMutation({
    mutationFn: async (sceneId: string) => {
      const res = await fetch("/api/ai/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Synopsis generation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenes", id] });
      toast("Synopsis generated", "success");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  const runBulkBreakdown = useCallback(async () => {
    if (bulkProgress?.running) return;

    setBulkProgress({ running: true, processed: 0, total: scenes.length, currentScene: "", totalAdded: 0 });

    try {
      const res = await fetch("/api/ai/breakdown-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Bulk breakdown failed" }));
        throw new Error(err.error || "Bulk breakdown failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataMatch = line.match(/^data:\s*(.*)/);
          if (!dataMatch) continue;
          try {
            const event = JSON.parse(dataMatch[1]);
            if (event.type === "progress") {
              setBulkProgress({
                running: true,
                processed: event.processed,
                total: event.total,
                currentScene: event.scene,
                totalAdded: event.totalAdded,
              });
              // Refresh scenes data every 10 scenes
              if (event.processed % 10 === 0) {
                qc.invalidateQueries({ queryKey: ["scenes", id] });
              }
            } else if (event.type === "done") {
              qc.invalidateQueries({ queryKey: ["scenes", id] });
              toast(`AI processed ${event.scenesProcessed} scenes, found ${event.totalAdded} new elements`, "success");
              setBulkProgress(null);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bulk breakdown failed", "error");
      setBulkProgress(null);
    }
  }, [bulkProgress, scenes.length, id, qc, toast]);

  const activeScene = scenes.find((s) => s.id === selectedScene) || scenes[0];
  const activeIdx = scenes.findIndex((s) => s.id === activeScene?.id);
  const allElements = activeScene ? getElements(activeScene) : [];
  const grouped = groupByCategory(allElements);

  // Only elements from elementsJson (not cast links) - these are what we can edit
  const editableElements: SceneElement[] = activeScene?.elementsJson
    ? (() => { try { return JSON.parse(activeScene.elementsJson); } catch { return []; } })()
    : [];

  const pendingCount = scenes.reduce((count, s) => {
    if (!s.elementsJson) return count;
    try {
      return count + JSON.parse(s.elementsJson).filter((e: SceneElement) => e.status === "pending").length;
    } catch { return count; }
  }, 0);

  const totalElements = scenes.reduce((count, s) => {
    const els = getElements(s);
    return count + els.length;
  }, 0);

  useEffect(() => {
    if (addingTo && addInputRef.current) addInputRef.current.focus();
  }, [addingTo]);

  const persistElements = useCallback((scene: Scene, newElements: SceneElement[]) => {
    updateMutation.mutate({
      sceneId: scene.id,
      elementsJson: JSON.stringify(newElements),
    });
  }, [updateMutation]);

  const addElement = (category: string) => {
    if (!addValue.trim() || !activeScene) return;
    const current = editableElements.slice();
    current.push({
      id: uid(),
      name: addValue.trim(),
      category,
      source: "manual",
      status: "accepted",
    });
    persistElements(activeScene, current);
    setAddValue("");
    setAddingTo(null);
    toast(`Added "${addValue.trim()}" to ${category}`, "success");
  };

  const deleteElement = (elId: string) => {
    if (!activeScene) return;
    const current = editableElements.filter((e: SceneElement) => e.id !== elId);
    persistElements(activeScene, current);
  };

  const renameElement = (elId: string) => {
    if (!editValue.trim() || !activeScene) return;
    const current = editableElements.map((e: SceneElement) =>
      e.id === elId ? { ...e, name: editValue.trim() } : e
    );
    persistElements(activeScene, current);
    setEditingEl(null);
    setEditValue("");
  };

  const acceptElement = (elId: string) => {
    if (!activeScene) return;
    const current = editableElements.map((e: SceneElement) =>
      e.id === elId ? { ...e, status: "accepted" } : e
    );
    persistElements(activeScene, current);
  };

  const rejectElement = (elId: string) => {
    if (!activeScene) return;
    const current = editableElements.filter((e: SceneElement) => e.id !== elId);
    persistElements(activeScene, current);
  };

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < scenes.length) {
      setSelectedScene(scenes[idx].id);
      setAddingTo(null);
      setEditingEl(null);
    }
  };

  /* ── Loading / Empty ─────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="skeleton w-64 h-8 rounded-md" />
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="sf-empty">
        <ListChecks size={48} className="sf-empty__icon" />
        <h3 className="sf-empty__title">No scenes yet</h3>
        <p className="sf-empty__text">Import a script to extract scenes for breakdown.</p>
        <button
          className="sf-btn sf-btn--primary"
          style={{ marginTop: 16 }}
          onClick={() => (window.location.href = `/projects/${id}/script`)}
        >
          Import Script
        </button>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────── */

  return (
    <div className="bd-layout">
      {/* ── Left: Script Panel ──────────────── */}
      <div className="bd-script">
        <div className="bd-toolbar">
          <div className="bd-toolbar__nav">
            <button className="bd-nav-btn" disabled={activeIdx <= 0} onClick={() => goTo(activeIdx - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="bd-toolbar__counter">
              Scene {activeIdx + 1} / {scenes.length}
            </span>
            <button className="bd-nav-btn" disabled={activeIdx >= scenes.length - 1} onClick={() => goTo(activeIdx + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="bd-toolbar__actions">
            <button
              className="bd-ai-btn"
              disabled={!activeScene || aiSynopsisMutation.isPending}
              onClick={() => activeScene && aiSynopsisMutation.mutate(activeScene.id)}
              title="Generate synopsis with AI"
            >
              {aiSynopsisMutation.isPending ? <Loader2 size={12} className="bd-spin" /> : <FileText size={12} />}
              Synopsis
            </button>
            <button
              className="bd-ai-btn bd-ai-btn--primary"
              disabled={!activeScene || aiBreakdownMutation.isPending}
              onClick={() => activeScene && aiBreakdownMutation.mutate(activeScene.id)}
              title="Auto-extract elements with AI"
            >
              {aiBreakdownMutation.isPending ? <Loader2 size={12} className="bd-spin" /> : <Wand2 size={12} />}
              AI Breakdown
            </button>
            <button
              className="bd-ai-btn"
              disabled={!!bulkProgress?.running || scenes.length === 0}
              onClick={() => {
                if (confirm(`Run AI breakdown on all ${scenes.length} scenes? This will process 3 scenes at a time.`)) {
                  runBulkBreakdown();
                }
              }}
              title="Run AI breakdown on all scenes"
            >
              {bulkProgress?.running ? <Loader2 size={12} className="bd-spin" /> : <Sparkles size={12} />}
              {bulkProgress?.running
                ? `${bulkProgress.processed}/${bulkProgress.total}`
                : "All Scenes"}
            </button>
            {pendingCount > 0 && (
              <button className="bd-review-btn" onClick={() => setReviewOpen(true)}>
                <Sparkles size={12} />
                Review ({pendingCount})
              </button>
            )}
          </div>
        </div>

        <div className="bd-script__content">
          {activeScene && (
            <div className="bd-screenplay">
              <div className="bd-scene-heading">
                <span className="bd-scene-num">{activeScene.sceneNumber}</span>
                <span className={cn("bd-badge", activeScene.intExt === "EXT" ? "bd-badge--ext" : "bd-badge--int")}>
                  {activeScene.intExt}
                </span>
                <span className="bd-scene-name">{activeScene.sceneName}</span>
                <span className={cn("bd-badge", activeScene.dayNight === "NIGHT" ? "bd-badge--night" : "bd-badge--day")}>
                  {activeScene.dayNight}
                </span>
              </div>
              {activeScene.content ? (
                <div className="bd-scene-text">
                  {activeScene.content.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} className="bd-scene-text__break" />;
                    // Detect character names (short uppercase lines or lines ending with character name patterns)
                    const isCharName = /^[A-Z][A-Za-z\s]{1,25}$/.test(trimmed) && trimmed.length < 30;
                    // Detect parenthetical directions
                    const isParenthetical = trimmed.startsWith("(") && trimmed.endsWith(")");
                    return (
                      <p
                        key={i}
                        className={cn(
                          "bd-scene-text__line",
                          isCharName && "bd-scene-text__character",
                          isParenthetical && "bd-scene-text__parenthetical"
                        )}
                      >
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="bd-synopsis">
                  {activeScene.synopsis || "No content available. Re-import the script to load full scene text."}
                </div>
              )}
              <div className="bd-meta">
                {activeScene.pageCount} page{activeScene.pageCount !== 1 ? "s" : ""} · {activeScene.status}
              </div>
            </div>
          )}
        </div>

        {/* Bulk progress bar */}
        {bulkProgress?.running && (
          <div className="bd-bulk-progress">
            <div className="bd-bulk-progress__bar">
              <div
                className="bd-bulk-progress__fill"
                style={{ width: `${(bulkProgress.processed / bulkProgress.total) * 100}%` }}
              />
            </div>
            <div className="bd-bulk-progress__text">
              <span>Scene {bulkProgress.currentScene} — {bulkProgress.processed}/{bulkProgress.total}</span>
              <span>{bulkProgress.totalAdded} elements found</span>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="bd-stats">
          <div className="bd-stats__item">
            <span className="bd-stats__num">{totalElements}</span>
            <span className="bd-stats__label">Total Elements</span>
          </div>
          <div className="bd-stats__item">
            <span className="bd-stats__num">{allElements.length}</span>
            <span className="bd-stats__label">This Scene</span>
          </div>
          <div className="bd-stats__item">
            <span className={cn("bd-stats__num", pendingCount > 0 && "bd-stats__num--warn")}>{pendingCount}</span>
            <span className="bd-stats__label">Pending Review</span>
          </div>
        </div>
      </div>

      {/* ── Right: Elements Panel ───────────── */}
      <div className="bd-elements">
        <div className="bd-elements__header">
          {activeScene && (
            <>
              <span className="bd-elements__scene-id">SC#{activeScene.sceneNumber}</span>
              <span className={cn("bd-badge bd-badge--sm", activeScene.intExt === "EXT" ? "bd-badge--ext" : "bd-badge--int")}>
                {activeScene.intExt}
              </span>
              <span className={cn("bd-badge bd-badge--sm", activeScene.dayNight === "NIGHT" ? "bd-badge--night" : "bd-badge--day")}>
                {activeScene.dayNight}
              </span>
              <span className="bd-elements__pages">{activeScene.pageCount}pp</span>
            </>
          )}
        </div>

        <div className="bd-elements__body">
          {CATEGORIES.map((cat) => {
            const items = grouped[cat.key] || [];
            const isAdding = addingTo === cat.key;

            return (
              <div key={cat.key} className="bd-cat">
                <div className="bd-cat__header">
                  <div className="bd-cat__dot" style={{ background: cat.color }} />
                  <span className="bd-cat__label">{cat.label}</span>
                  <span className="bd-cat__count">{items.length}</span>
                </div>

                {items.length > 0 && (
                  <div className="bd-cat__items">
                    {items.map((item) => {
                      const isEditing = editingEl === item.id;
                      const isPending = item.status === "pending";
                      const isLinked = item.source === "linked";

                      return (
                        <div
                          key={item.id || item.name}
                          className={cn(
                            "bd-element",
                            isPending && "bd-element--pending",
                            isLinked && "bd-element--linked",
                          )}
                          style={{ borderLeftColor: cat.color }}
                        >
                          {isEditing ? (
                            <form
                              className="bd-element__edit-form"
                              onSubmit={(e) => { e.preventDefault(); renameElement(item.id!); }}
                            >
                              <input
                                className="bd-element__edit-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                autoFocus
                                onBlur={() => { setEditingEl(null); setEditValue(""); }}
                                onKeyDown={(e) => { if (e.key === "Escape") { setEditingEl(null); setEditValue(""); } }}
                              />
                            </form>
                          ) : (
                            <>
                              <span className="bd-element__name">{item.name}</span>
                              <div className="bd-element__actions">
                                {isPending && (
                                  <>
                                    <button className="bd-el-btn bd-el-btn--accept" title="Accept" onClick={() => acceptElement(item.id!)}>
                                      <Check size={11} />
                                    </button>
                                    <button className="bd-el-btn bd-el-btn--reject" title="Reject" onClick={() => rejectElement(item.id!)}>
                                      <X size={11} />
                                    </button>
                                  </>
                                )}
                                {item.source === "ai" && <span className="bd-el-tag bd-el-tag--ai">AI</span>}
                                {isLinked && <span className="bd-el-tag bd-el-tag--link">Linked</span>}
                                {!isLinked && !isPending && (
                                  <>
                                    <button
                                      className="bd-el-btn bd-el-btn--edit"
                                      title="Rename"
                                      onClick={() => { setEditingEl(item.id!); setEditValue(item.name); }}
                                    >
                                      <Pencil size={10} />
                                    </button>
                                    <button className="bd-el-btn bd-el-btn--delete" title="Remove" onClick={() => deleteElement(item.id!)}>
                                      <Trash2 size={10} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdding ? (
                  <form
                    className="bd-cat__add-form"
                    onSubmit={(e) => { e.preventDefault(); addElement(cat.key); }}
                  >
                    <input
                      ref={addInputRef}
                      className="bd-cat__add-input"
                      placeholder={`Add ${cat.label.toLowerCase()}...`}
                      value={addValue}
                      onChange={(e) => setAddValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") { setAddingTo(null); setAddValue(""); } }}
                    />
                    <button type="submit" className="bd-cat__add-confirm" disabled={!addValue.trim()}>
                      <Check size={12} />
                    </button>
                    <button type="button" className="bd-cat__add-cancel" onClick={() => { setAddingTo(null); setAddValue(""); }}>
                      <X size={12} />
                    </button>
                  </form>
                ) : (
                  <button className="bd-cat__add-btn" onClick={() => { setAddingTo(cat.key); setAddValue(""); }}>
                    <Plus size={11} />
                    Add {cat.label.toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Mini navigator */}
        <div className="bd-navigator">
          {scenes.map((s) => {
            const elCount = getElements(s).length;
            const hasPending = (() => {
              try { return JSON.parse(s.elementsJson || "[]").some((e: SceneElement) => e.status === "pending"); }
              catch { return false; }
            })();
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedScene(s.id); setAddingTo(null); setEditingEl(null); }}
                className={cn(
                  "bd-navigator__btn",
                  s.id === activeScene?.id && "is-active",
                  hasPending && "has-pending",
                )}
                title={`Scene ${s.sceneNumber} — ${elCount} elements`}
              >
                {s.sceneNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Modal */}
      {reviewOpen && (
        <ReviewModal
          projectId={id}
          scenes={scenes}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Review Modal (inline, replaces the old component) ── */

function ReviewModal({ projectId, scenes, onClose }: { projectId: string; scenes: Scene[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  const pendingItems = scenes.flatMap((scene) => {
    if (!scene.elementsJson) return [];
    try {
      const elements: SceneElement[] = JSON.parse(scene.elementsJson);
      return elements
        .filter((el) => el.status === "pending")
        .map((el, i) => ({ scene, element: el, elementIndex: i }));
    } catch { return []; }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sceneId, elementsJson }: { sceneId: string; elementsJson: string }) => {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elementsJson }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", projectId] }),
  });

  const handleAction = (status: "accepted" | "rejected") => {
    const item = pendingItems[currentIndex];
    if (!item) return;

    let elements: SceneElement[] = [];
    try { elements = JSON.parse(item.scene.elementsJson || "[]"); } catch { /* */ }

    const updated = status === "rejected"
      ? elements.filter((el) => el.id !== item.element.id)
      : elements.map((el) => el.id === item.element.id ? { ...el, status: "accepted" } : el);

    updateMutation.mutate({ sceneId: item.scene.id, elementsJson: JSON.stringify(updated) });
    setCurrentIndex((prev) => prev + 1);
  };

  const remaining = pendingItems.length - currentIndex;
  const current = pendingItems[currentIndex];

  return (
    <div className="bd-modal-overlay" onClick={onClose}>
      <div className="bd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bd-modal__header">
          <div className="bd-modal__header-left">
            <div className="bd-modal__icon"><BrainCircuit size={18} /></div>
            <div>
              <h2 className="bd-modal__title">AI Breakdown Review</h2>
              <p className="bd-modal__subtitle">Accept or reject extracted elements</p>
            </div>
          </div>
          <button className="bd-modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bd-modal__body">
          {remaining <= 0 ? (
            <div className="bd-modal__done">
              <div className="bd-modal__done-icon"><Check size={28} /></div>
              <h3>Review Complete</h3>
              <p>All AI-extracted elements have been validated.</p>
              <button className="bd-modal__done-btn" onClick={onClose}>Done</button>
            </div>
          ) : current && (
            <div className="bd-modal__review">
              <div className="bd-modal__progress">
                <span>{currentIndex + 1} of {pendingItems.length}</span>
                <span className="bd-modal__pending-tag"><AlertOctagon size={11} /> Needs Review</span>
              </div>

              <div className="bd-modal__context">
                <div className="bd-modal__context-header">
                  <span className="bd-modal__context-num">{current.scene.sceneNumber}</span>
                  <span className="bd-modal__context-heading">
                    {current.scene.intExt}. {current.scene.sceneName} - {current.scene.dayNight}
                  </span>
                </div>
                <p className="bd-modal__context-text">
                  {current.scene.synopsis || "No synopsis available."}
                </p>
              </div>

              <div className="bd-modal__element">
                <span className="bd-modal__element-cat">{current.element.category}</span>
                <h1 className="bd-modal__element-name">{current.element.name}</h1>
                {current.element.confidence && (
                  <span className="bd-modal__element-conf">
                    Confidence: {(current.element.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="bd-modal__actions">
                <button className="bd-modal__btn bd-modal__btn--reject" onClick={() => handleAction("rejected")}>
                  <X size={16} /> Reject
                </button>
                <button className="bd-modal__btn bd-modal__btn--accept" onClick={() => handleAction("accepted")}>
                  <Check size={16} /> Accept
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
