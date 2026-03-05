"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Shot {
  id: string; shotNumber: string; shotType: string; cameraMovement: string;
  lensMm: number | null; durationSeconds: number; setupTimeMinutes: number;
  description: string | null; isVfx: boolean; order: number;
}

interface Scene {
  id: string; sceneNumber: string; sceneName: string; intExt: string; dayNight: string;
  pageCount: number; status: string; shootDayId: string | null;
  shots: Shot[];
}

interface Project {
  id: string; title: string;
  shootDays: { id: string; dayNumber: number; scenes: Scene[] }[];
  scenes: Scene[];
}

const SHOT_TYPES = ["Wide", "Medium", "Close-Up", "Extreme Close-Up", "Over-the-Shoulder", "POV", "Insert", "Aerial", "Establishing", "Two-Shot", "Tracking"];
const CAMERA_MOVEMENTS = ["Static", "Pan", "Tilt", "Dolly", "Steadicam", "Handheld", "Crane", "Drone", "Slider", "Whip Pan"];

export default function ShotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [addingShot, setAddingShot] = useState<string | null>(null);
  const [shotForm, setShotForm] = useState({
    shotNumber: "", shotType: "Wide", cameraMovement: "Static",
    lensMm: "", durationSeconds: "0", setupTimeMinutes: "15", description: "", isVfx: false,
  });

  const { data: project } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()),
  });

  const addShotMutation = useMutation({
    mutationFn: ({ sceneId, data }: { sceneId: string; data: typeof shotForm }) =>
      fetch(`/api/projects/${id}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          sceneId,
          lensMm: data.lensMm ? Number(data.lensMm) : null,
          durationSeconds: Number(data.durationSeconds),
          setupTimeMinutes: Number(data.setupTimeMinutes),
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setAddingShot(null);
      setShotForm({ shotNumber: "", shotType: "Wide", cameraMovement: "Static", lensMm: "", durationSeconds: "0", setupTimeMinutes: "15", description: "", isVfx: false });
    },
  });

  const deleteShotMutation = useMutation({
    mutationFn: (shotId: string) => fetch(`/api/projects/${id}/shots/${shotId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const allScenes = [
    ...(project?.shootDays.flatMap(d => d.scenes.map(s => ({ ...s, dayNumber: d.dayNumber }))) ?? []),
    ...(project?.scenes.map(s => ({ ...s, dayNumber: null })) ?? []),
  ];

  const toggleScene = (id: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-[#555] text-sm">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-semibold text-sm">Shot List</h2>
          <p className="text-[#555] text-xs mt-0.5">
            {allScenes.length} scenes · {allScenes.reduce((s, sc) => s + sc.shots.length, 0)} shots
          </p>
        </div>
        <button
          onClick={() => setExpandedScenes(new Set(allScenes.map(s => s.id)))}
          className="px-3 py-1.5 bg-[#1a1a1a] text-[#888] text-xs rounded-lg hover:bg-[#222]"
        >
          Expand All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {allScenes.length === 0 ? (
          <div className="text-center py-12 text-[#555] text-sm">
            No scenes yet. Add scenes in the Schedule view first.
          </div>
        ) : (
          allScenes.map(scene => {
            const isExpanded = expandedScenes.has(scene.id);
            const totalSetup = scene.shots.reduce((s, sh) => s + sh.setupTimeMinutes, 0);
            const totalDuration = scene.shots.reduce((s, sh) => s + sh.durationSeconds, 0);

            return (
              <div key={scene.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
                {/* Scene Header */}
                <button
                  onClick={() => toggleScene(scene.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#111] transition-colors text-left"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"
                    className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                  <span className="text-white font-mono text-sm font-bold w-8">{scene.sceneNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className={scene.intExt === "INT" ? "badge-int" : "badge-ext"}>{scene.intExt}</span>
                    <span className={scene.dayNight === "DAY" ? "badge-day" : "badge-night"}>{scene.dayNight}</span>
                  </div>
                  <span className="text-[#ccc] text-sm flex-1 truncate">{scene.sceneName}</span>
                  <div className="flex items-center gap-3 text-[10px] text-[#555] ml-auto flex-shrink-0">
                    {(scene as { dayNumber?: number | null }).dayNumber && <span>Day {(scene as { dayNumber?: number | null }).dayNumber}</span>}
                    <span>{scene.shots.length} shots</span>
                    {totalSetup > 0 && <span>{totalSetup}min setup</span>}
                    {totalDuration > 0 && <span>{Math.round(totalDuration / 60)}min screen</span>}
                  </div>
                </button>

                {/* Shots */}
                {isExpanded && (
                  <div className="border-t border-[#1a1a1a]">
                    {scene.shots.length > 0 && (
                      <div className="divide-y divide-[#1a1a1a]">
                        {/* Column headers */}
                        <div className="grid grid-cols-[60px_100px_100px_60px_60px_60px_1fr_32px] gap-2 px-4 py-1.5 bg-[#0a0a0a] text-[10px] text-[#444] uppercase tracking-wider">
                          <span>Shot #</span><span>Type</span><span>Movement</span><span>Lens</span>
                          <span>Setup</span><span>Duration</span><span>Description</span><span></span>
                        </div>
                        {scene.shots.map(shot => (
                          <div key={shot.id} className="grid grid-cols-[60px_100px_100px_60px_60px_60px_1fr_32px] gap-2 px-4 py-2 items-center group hover:bg-[#111]">
                            <span className="text-white font-mono text-xs font-semibold">{shot.shotNumber}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#ccc] text-xs truncate">{shot.shotType}</span>
                              {shot.isVfx && <span className="text-[10px] bg-[#4c1d95] text-[#c4b5fd] px-1 rounded">VFX</span>}
                            </div>
                            <span className="text-[#888] text-xs truncate">{shot.cameraMovement}</span>
                            <span className="text-[#666] text-xs">{shot.lensMm ? `${shot.lensMm}mm` : "—"}</span>
                            <span className="text-[#666] text-xs">{shot.setupTimeMinutes}m</span>
                            <span className="text-[#666] text-xs">{shot.durationSeconds}s</span>
                            <span className="text-[#555] text-xs truncate">{shot.description || "—"}</span>
                            <button
                              onClick={() => deleteShotMutation.mutate(shot.id)}
                              className="text-[#333] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Shot */}
                    {addingShot === scene.id ? (
                      <div className="p-4 bg-[#0a0a0a] border-t border-[#1a1a1a]">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Shot Number</label>
                            <input className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              placeholder="1A" value={shotForm.shotNumber}
                              onChange={e => setShotForm(f => ({ ...f, shotNumber: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Lens (mm)</label>
                            <input type="number" className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              placeholder="35" value={shotForm.lensMm}
                              onChange={e => setShotForm(f => ({ ...f, lensMm: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Shot Type</label>
                            <select className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              value={shotForm.shotType} onChange={e => setShotForm(f => ({ ...f, shotType: e.target.value }))}>
                              {SHOT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Camera Movement</label>
                            <select className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              value={shotForm.cameraMovement} onChange={e => setShotForm(f => ({ ...f, cameraMovement: e.target.value }))}>
                              {CAMERA_MOVEMENTS.map(m => <option key={m}>{m}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Setup (min)</label>
                            <input type="number" className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              value={shotForm.setupTimeMinutes} onChange={e => setShotForm(f => ({ ...f, setupTimeMinutes: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#555] block mb-1">Duration (sec)</label>
                            <input type="number" className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                              value={shotForm.durationSeconds} onChange={e => setShotForm(f => ({ ...f, durationSeconds: e.target.value }))} />
                          </div>
                          <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={shotForm.isVfx} onChange={e => setShotForm(f => ({ ...f, isVfx: e.target.checked }))} />
                              <span className="text-[10px] text-[#888]">VFX Shot</span>
                            </label>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-[10px] text-[#555] block mb-1">Description</label>
                          <input className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#f59e0b]"
                            placeholder="Shot description..."
                            value={shotForm.description} onChange={e => setShotForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setAddingShot(null)} className="px-3 py-1.5 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
                          <button
                            onClick={() => shotForm.shotNumber && addShotMutation.mutate({ sceneId: scene.id, data: shotForm })}
                            disabled={!shotForm.shotNumber || addShotMutation.isPending}
                            className="px-3 py-1.5 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {addShotMutation.isPending ? "Adding..." : "Add Shot"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingShot(scene.id)}
                        className="w-full py-2.5 text-[#444] hover:text-[#888] text-xs border-t border-[#1a1a1a] hover:bg-[#0f0f0f] transition-colors"
                      >
                        + Add Shot
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
