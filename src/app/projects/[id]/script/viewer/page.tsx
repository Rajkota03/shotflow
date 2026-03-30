"use client";
import { useState, useMemo, use, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  synopsis: string | null;
}

export default function ScriptViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: scenes = [], isLoading } = useQuery<Scene[]>({
    queryKey: ["scenes", id],
    queryFn: () => fetch(`/api/projects/${id}/scenes`).then((r) => r.json()),
  });

  // Set first scene as active on load
  useEffect(() => {
    if (scenes.length > 0 && !activeSceneId) {
      setActiveSceneId(scenes[0].id);
    }
  }, [scenes, activeSceneId]);

  const filtered = useMemo(() => {
    if (!search) return scenes;
    const q = search.toLowerCase();
    return scenes.filter(
      (s) =>
        s.sceneName.toLowerCase().includes(q) ||
        s.sceneNumber.includes(q) ||
        s.synopsis?.toLowerCase().includes(q)
    );
  }, [scenes, search]);

  const scrollToScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    const el = document.getElementById(`scene-${sceneId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeSceneId) return;
      const idx = scenes.findIndex((s) => s.id === activeSceneId);
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowDown") {
        e.preventDefault();
        if (idx < scenes.length - 1) scrollToScene(scenes[idx + 1].id);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowUp") {
        e.preventDefault();
        if (idx > 0) scrollToScene(scenes[idx - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" className="mb-5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 className="sf-empty-title">No script imported</h3>
        <p className="sf-empty-desc">Import a script to view it here.</p>
        <Button onClick={() => (window.location.href = `/projects/${id}/script`)}>Import Script</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar — Scene Navigator (240px) */}
      <div className="w-[240px] flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-surface-1)" }}>
        <div className="p-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <input
            className="sf-input"
            style={{ height: 32, width: "100%", fontSize: "var(--text-sm)" }}
            placeholder="Search scenes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((scene) => (
            <button
              key={scene.id}
              onClick={() => scrollToScene(scene.id)}
              className="w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2"
              style={{
                background: scene.id === activeSceneId ? "var(--blue-subtle)" : "transparent",
                borderLeft: scene.id === activeSceneId ? "3px solid var(--blue-primary)" : "3px solid transparent",
              }}
            >
              <span
                className="text-mono-num flex-shrink-0"
                style={{ fontSize: "var(--text-xs)", color: scene.id === activeSceneId ? "var(--blue-primary)" : "var(--text-tertiary)", minWidth: 20 }}
              >
                {scene.sceneNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: scene.id === activeSceneId ? "var(--text-primary)" : "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {scene.sceneName}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant={scene.intExt === "EXT" ? "ext" : "int"}>{scene.intExt}</Badge>
                  <Badge variant={scene.dayNight === "NIGHT" ? "night" : "day"}>{scene.dayNight}</Badge>
                  <span className="text-mono-num" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {scene.pageCount}pp
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-3 py-2 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          {scenes.length} scenes · {scenes.reduce((s, sc) => s + sc.pageCount, 0).toFixed(1)}pp
        </div>
      </div>

      {/* Right — Formatted Script */}
      <div className="flex-1 overflow-auto" ref={contentRef}>
        <div className="max-w-[680px] mx-auto px-8 py-10" style={{ fontFamily: "var(--font-screenplay)" }}>
          {/* Title Block */}
          <div className="text-center mb-12 pb-8" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Formatted Script View
            </p>
            <p className="text-mono-num" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {scenes.length} scenes · {scenes.reduce((s, sc) => s + sc.pageCount, 0).toFixed(1)} pages
            </p>
          </div>

          {/* Scenes */}
          {scenes.map((scene, idx) => (
            <div
              key={scene.id}
              id={`scene-${scene.id}`}
              className="mb-10 relative group"
              style={{
                paddingLeft: 16,
                borderLeft: scene.id === activeSceneId ? "3px solid var(--blue-primary)" : "3px solid transparent",
                transition: "border-color 200ms ease",
              }}
              onClick={() => setActiveSceneId(scene.id)}
            >
              {/* Scene Number (margin) */}
              <div
                className="absolute text-mono-num"
                style={{
                  right: "calc(100% + 12px)",
                  top: 0,
                  fontSize: "var(--text-sm)",
                  color: "var(--text-tertiary)",
                  opacity: 0.6,
                }}
              >
                {scene.sceneNumber}
              </div>

              {/* Scene Heading */}
              <div className="scene-heading" style={{ marginBottom: 8 }}>
                {scene.intExt}. {scene.sceneName} - {scene.dayNight}
              </div>

              {/* Synopsis / Action */}
              {scene.synopsis && (
                <div className="action-line" style={{ marginBottom: 12 }}>
                  {scene.synopsis}
                </div>
              )}

              {/* Page count */}
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textAlign: "right" }}>
                {scene.pageCount}pp
              </div>

              {/* Scene divider */}
              {idx < scenes.length - 1 && (
                <div style={{ borderBottom: "1px solid var(--border-subtle)", marginTop: 16 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
