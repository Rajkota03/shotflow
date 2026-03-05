"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBudgetStore } from "@/store/budget-store";

interface CastMember { id: string; name: string; characterName: string | null; dayRate: number; roleType: string; }
interface Scene {
  id: string; sceneNumber: string; sceneName: string; intExt: string; dayNight: string;
  pageCount: number; synopsis: string | null; status: string; shootDayId: string | null;
  castLinks: { castMember: CastMember }[];
  shots: { id: string }[];
}
interface Location { id: string; name: string; dailyRentalCost: number; permitCost: number; }
interface ShootDay {
  id: string; dayNumber: number; date: string | null; callTime: string | null;
  dayType: string; locationId: string | null; location: Location | null;
  scenes: Scene[];
}
interface Project {
  id: string; title: string; currency: string; budgetCap: number;
  shootDays: ShootDay[];
  scenes: Scene[];
  castMembers: CastMember[];
  locations: Location[];
}

// ─── Scene Card ───────────────────────────────────────────────────────────────
function SceneCard({
  scene, isDragging = false, onAssignCast, onEdit,
}: {
  scene: Scene; isDragging?: boolean;
  onAssignCast?: (scene: Scene) => void;
  onEdit?: (scene: Scene) => void;
}) {
  const isDay = scene.dayNight === "DAY";
  const isInt = scene.intExt === "INT";

  return (
    <div
      className={`rounded-lg border-l-2 px-3 py-2 select-none group/card ${
        isDragging ? "opacity-60 shadow-2xl cursor-grabbing" : "cursor-grab hover:bg-[#1a1a1a]"
      } ${isInt ? "border-[#3b82f6]" : "border-[#10b981]"} bg-[#111] border border-[#1e1e1e]`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-xs font-mono font-semibold">{scene.sceneNumber}</span>
        <div className="flex items-center gap-1">
          <span className={isDay ? "badge-day" : "badge-night"}>{scene.dayNight}</span>
          <span className={isInt ? "badge-int" : "badge-ext"}>{scene.intExt}</span>
        </div>
      </div>
      <p className="text-[#ccc] text-xs font-medium truncate">{scene.sceneName}</p>
      {scene.synopsis && (
        <p className="text-[#555] text-[10px] mt-0.5 truncate">{scene.synopsis}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-[#666]">{scene.pageCount}p</span>
        {scene.castLinks.length > 0 && (
          <div className="flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
            </svg>
            <span className="text-[10px] text-[#666]">
              {scene.castLinks.slice(0, 2).map(l => l.castMember.name.split(" ")[0]).join(", ")}
              {scene.castLinks.length > 2 && ` +${scene.castLinks.length - 2}`}
            </span>
          </div>
        )}
        {scene.shots.length > 0 && (
          <span className="text-[10px] text-[#666]">{scene.shots.length} shots</span>
        )}
      </div>
      {/* Action buttons — only show on hover, stop drag propagation */}
      {(onAssignCast || onEdit) && (
        <div
          className="flex gap-1 mt-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity"
          onPointerDown={e => e.stopPropagation()}
        >
          {onAssignCast && (
            <button
              onClick={e => { e.stopPropagation(); onAssignCast(scene); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#3b82f6] text-[10px] hover:bg-[#1e2a4a]"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100 0"/>
              </svg>
              Cast
            </button>
          )}
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(scene); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888] text-[10px] hover:bg-[#222]"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableSceneCard({
  scene, onAssignCast, onEdit,
}: {
  scene: Scene;
  onAssignCast: (scene: Scene) => void;
  onEdit: (scene: Scene) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
    data: { type: "scene", scene },
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <SceneCard scene={scene} isDragging={isDragging} onAssignCast={onAssignCast} onEdit={onEdit} />
    </div>
  );
}

function DroppableDay({
  day, scenes, projectId, onEdit, onAssignCast, onEditScene,
}: {
  day: ShootDay; scenes: Scene[]; projectId: string;
  onEdit: (day: ShootDay) => void;
  onAssignCast: (scene: Scene) => void;
  onEditScene: (scene: Scene) => void;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `day-${day.id}`,
    data: { type: "day", dayId: day.id },
  });

  const totalPageCount = scenes.reduce((s, sc) => s + sc.pageCount, 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-56 flex flex-col rounded-xl border transition-colors ${
        isOver ? "border-[#f59e0b]/50 bg-[#f59e0b]/5" : "border-[#1a1a1a] bg-[#0d0d0d]"
      }`}
    >
      <div className="px-3 py-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-white text-sm font-semibold">Day {day.dayNumber}</span>
          <button onClick={() => onEdit(day)} className="text-[#444] hover:text-[#888] p-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>
        {day.date && (
          <p className="text-[10px] text-[#555]">
            {new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        )}
        {day.location && <p className="text-[10px] text-[#3b82f6] mt-0.5 truncate">{day.location.name}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[#555]">{scenes.length} scenes</span>
          <span className="text-[10px] text-[#555]">{totalPageCount.toFixed(1)}p</span>
          <span className={`text-[10px] px-1.5 rounded ${
            day.dayType === "half" ? "bg-[#292524] text-[#a8a29e]"
            : day.dayType === "company_move" ? "bg-[#1e1b4b] text-[#818cf8]"
            : "bg-[#0f2417] text-[#4ade80]"
          }`}>{day.dayType === "company_move" ? "Move" : day.dayType}</span>
        </div>
      </div>

      <SortableContext items={scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-1.5 min-h-20 overflow-y-auto max-h-[calc(100vh-280px)]">
          {scenes.map(scene => (
            <SortableSceneCard key={scene.id} scene={scene} onAssignCast={onAssignCast} onEdit={onEditScene} />
          ))}
          {scenes.length === 0 && (
            <div className="h-16 flex items-center justify-center text-[#333] text-xs border border-dashed border-[#222] rounded-lg">
              Drop scenes here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Cast Assignment Modal ─────────────────────────────────────────────────────
function CastAssignModal({
  scene, allCast, projectId, onClose,
}: {
  scene: Scene; allCast: CastMember[]; projectId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const assignedIds = new Set(scene.castLinks.map(l => l.castMember.id));

  const toggleMutation = useMutation({
    mutationFn: ({ castId, assigned }: { castId: string; assigned: boolean }) => {
      if (assigned) {
        return fetch(`/api/projects/${projectId}/scenes/${scene.id}/cast`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ castId }),
        });
      }
      return fetch(`/api/projects/${projectId}/scenes/${scene.id}/cast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ castId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      refreshBudget(projectId);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold text-sm">Assign Cast</h3>
          <button onClick={onClose} className="text-[#555] hover:text-[#888]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <p className="text-[#555] text-xs mb-4">
          Scene {scene.sceneNumber} — {scene.sceneName}
        </p>

        {allCast.length === 0 ? (
          <p className="text-[#555] text-xs py-4 text-center">
            No cast members yet. Add them in the Cast tab first.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {allCast.map(member => {
              const isAssigned = assignedIds.has(member.id);
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMutation.mutate({ castId: member.id, assigned: isAssigned })}
                  disabled={toggleMutation.isPending}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    isAssigned
                      ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 hover:bg-[#3b82f6]/15"
                      : "bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isAssigned ? "bg-[#3b82f6] border-[#3b82f6]" : "border-[#333]"
                  }`}>
                    {isAssigned && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{member.name}</p>
                    {member.characterName && (
                      <p className="text-[#555] text-[10px]">{member.characterName}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#555] capitalize flex-shrink-0">
                    {member.roleType.replace("_", " ")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg hover:bg-[#222]">
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Scene Edit Modal ──────────────────────────────────────────────────────────
function EditSceneModal({
  scene, projectId, onClose,
}: {
  scene: Scene; projectId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sceneNumber: scene.sceneNumber,
    sceneName: scene.sceneName,
    intExt: scene.intExt,
    dayNight: scene.dayNight,
    pageCount: String(scene.pageCount),
    synopsis: scene.synopsis || "",
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/projects/${projectId}/scenes/${scene.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pageCount: Number(data.pageCount) }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", projectId] }); onClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/projects/${projectId}/scenes/${scene.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", projectId] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 w-full max-w-md">
        <h3 className="text-white font-semibold mb-4">Edit Scene</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] block mb-1">Scene #</label>
              <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.sceneNumber} onChange={e => setForm(f => ({ ...f, sceneNumber: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#888] block mb-1">Page Count</label>
              <input type="number" step="0.125" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.pageCount} onChange={e => setForm(f => ({ ...f, pageCount: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Scene Name</label>
            <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
              value={form.sceneName} onChange={e => setForm(f => ({ ...f, sceneName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] block mb-1">INT / EXT</label>
              <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.intExt} onChange={e => setForm(f => ({ ...f, intExt: e.target.value }))}>
                <option value="INT">INT</option>
                <option value="EXT">EXT</option>
                <option value="INT/EXT">INT/EXT</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#888] block mb-1">DAY / NIGHT</label>
              <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.dayNight} onChange={e => setForm(f => ({ ...f, dayNight: e.target.value }))}>
                <option value="DAY">DAY</option>
                <option value="NIGHT">NIGHT</option>
                <option value="DAWN">DAWN</option>
                <option value="DUSK">DUSK</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Synopsis</label>
            <textarea className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b] resize-none"
              rows={2} value={form.synopsis} onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => { if (confirm("Delete this scene?")) deleteMutation.mutate(); }}
            className="px-3 py-2 text-[#ef4444] text-xs hover:bg-[#1a1a1a] rounded-lg">Delete</button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg disabled:opacity-50"
          >Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [editDay, setEditDay] = useState<ShootDay | null>(null);
  const [assignCastScene, setAssignCastScene] = useState<Scene | null>(null);
  const [editScene, setEditScene] = useState<Scene | null>(null);
  const [showAddScene, setShowAddScene] = useState(false);
  const [sceneForm, setSceneForm] = useState({
    sceneNumber: "", sceneName: "", intExt: "INT", dayNight: "DAY", pageCount: "1", synopsis: "",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()),
  });

  const addDayMutation = useMutation({
    mutationFn: () => fetch(`/api/projects/${id}/shoot-days`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); refreshBudget(id); },
  });

  const updateDayMutation = useMutation({
    mutationFn: ({ dayId, data }: { dayId: string; data: object }) =>
      fetch(`/api/projects/${id}/shoot-days/${dayId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); refreshBudget(id); },
  });

  const deleteDayMutation = useMutation({
    mutationFn: (dayId: string) => fetch(`/api/projects/${id}/shoot-days/${dayId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); refreshBudget(id); },
  });

  const moveSceneMutation = useMutation({
    mutationFn: ({ sceneId, shootDayId }: { sceneId: string; shootDayId: string | null }) =>
      fetch(`/api/projects/${id}/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootDayId, status: shootDayId ? "scheduled" : "unscheduled" }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); refreshBudget(id); },
  });

  const addSceneMutation = useMutation({
    mutationFn: (data: typeof sceneForm) =>
      fetch(`/api/projects/${id}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pageCount: Number(data.pageCount) }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setShowAddScene(false);
      setSceneForm({ sceneNumber: "", sceneName: "", intExt: "INT", dayNight: "DAY", pageCount: "1", synopsis: "" });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const scene = event.active.data.current?.scene;
    if (scene) setActiveScene(scene);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveScene(null);
    const { active, over } = event;
    if (!over || !project) return;

    const draggedSceneId = active.id as string;
    const overId = over.id as string;

    let targetDayId: string | null = null;

    if (overId.startsWith("day-")) {
      targetDayId = overId.replace("day-", "");
    } else if (overId === "unscheduled") {
      targetDayId = null;
    } else {
      const allScheduled = project.shootDays.flatMap(d => d.scenes);
      const targetScene = allScheduled.find(s => s.id === overId);
      if (targetScene) {
        const targetDay = project.shootDays.find(d => d.scenes.some(s => s.id === overId));
        targetDayId = targetDay?.id ?? null;
      }
    }

    const currentDay = project.shootDays.find(d => d.scenes.some(s => s.id === draggedSceneId));
    const currentDayId = currentDay?.id ?? null;

    if (targetDayId !== currentDayId) {
      moveSceneMutation.mutate({ sceneId: draggedSceneId, shootDayId: targetDayId });
    }
  }

  if (isLoading || !project) {
    return <div className="flex-1 flex items-center justify-center"><div className="text-[#555] text-sm">Loading schedule...</div></div>;
  }

  const unscheduledScenes = project.scenes || [];
  const totalScenes = project.shootDays.flatMap(d => d.scenes).length + unscheduledScenes.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold text-sm">Stripboard</h2>
          <span className="text-[#555] text-xs">{project.shootDays.length} days · {totalScenes} scenes</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddScene(true)} className="px-3 py-1.5 bg-[#1a1a1a] text-[#ccc] text-xs rounded-lg hover:bg-[#222]">
            + Add Scene
          </button>
          <button
            onClick={() => addDayMutation.mutate()}
            disabled={addDayMutation.isPending}
            className="px-3 py-1.5 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg hover:bg-[#d97706] disabled:opacity-50"
          >
            + Add Shoot Day
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full items-start">
            {/* Unscheduled Column */}
            <div className="flex-shrink-0 w-52 flex flex-col rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
              <div className="px-3 py-2.5 border-b border-[#1a1a1a]">
                <span className="text-[#888] text-sm font-medium">Unscheduled</span>
                <p className="text-[10px] text-[#444] mt-0.5">{unscheduledScenes.length} scenes</p>
              </div>
              <SortableContext items={["unscheduled", ...unscheduledScenes.map(s => s.id)]} strategy={verticalListSortingStrategy}>
                <div id="unscheduled" className="p-2 space-y-1.5 flex-1 min-h-20 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {unscheduledScenes.map(scene => (
                    <SortableSceneCard key={scene.id} scene={scene} onAssignCast={setAssignCastScene} onEdit={setEditScene} />
                  ))}
                  {unscheduledScenes.length === 0 && (
                    <div className="h-16 flex items-center justify-center text-[#333] text-xs">All scheduled</div>
                  )}
                </div>
              </SortableContext>
            </div>

            {/* Shoot Day Columns */}
            <SortableContext items={project.shootDays.map(d => `day-${d.id}`)} strategy={verticalListSortingStrategy}>
              {project.shootDays.map(day => (
                <DroppableDay
                  key={day.id}
                  day={day}
                  scenes={day.scenes}
                  projectId={id}
                  onEdit={setEditDay}
                  onAssignCast={setAssignCastScene}
                  onEditScene={setEditScene}
                />
              ))}
            </SortableContext>

            <button
              onClick={() => addDayMutation.mutate()}
              className="flex-shrink-0 w-52 h-24 flex items-center justify-center border border-dashed border-[#222] rounded-xl text-[#444] hover:text-[#666] hover:border-[#333] transition-colors text-sm"
            >
              + Add Day
            </button>
          </div>

          <DragOverlay>
            {activeScene && <SceneCard scene={activeScene} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {editDay && (
        <EditDayModal
          day={editDay}
          locations={project.locations}
          onSave={(data) => { updateDayMutation.mutate({ dayId: editDay.id, data }); setEditDay(null); }}
          onDelete={() => { if (confirm(`Delete Shoot Day ${editDay.dayNumber}?`)) { deleteDayMutation.mutate(editDay.id); setEditDay(null); } }}
          onClose={() => setEditDay(null)}
        />
      )}
      {showAddScene && (
        <AddSceneModal
          form={sceneForm}
          onChange={setSceneForm}
          onSave={() => addSceneMutation.mutate(sceneForm)}
          onClose={() => setShowAddScene(false)}
          isPending={addSceneMutation.isPending}
        />
      )}
      {assignCastScene && project && (
        <CastAssignModal
          scene={assignCastScene}
          allCast={project.castMembers}
          projectId={id}
          onClose={() => setAssignCastScene(null)}
        />
      )}
      {editScene && (
        <EditSceneModal
          scene={editScene}
          projectId={id}
          onClose={() => setEditScene(null)}
        />
      )}
    </div>
  );
}

// ─── Edit Day Modal ────────────────────────────────────────────────────────────
function EditDayModal({ day, locations, onSave, onDelete, onClose }: {
  day: ShootDay; locations: Location[];
  onSave: (data: object) => void; onDelete: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    date: day.date ? day.date.split("T")[0] : "",
    callTime: day.callTime || "",
    dayType: day.dayType,
    locationId: day.locationId || "",
  });
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 w-full max-w-sm">
        <h3 className="text-white font-semibold mb-4">Edit Shoot Day {day.dayNumber}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#888] block mb-1">Date</label>
            <input type="date" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] block mb-1">Call Time</label>
              <input type="time" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.callTime} onChange={e => setForm(f => ({ ...f, callTime: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#888] block mb-1">Day Type</label>
              <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.dayType} onChange={e => setForm(f => ({ ...f, dayType: e.target.value }))}>
                <option value="full">Full Day</option>
                <option value="half">Half Day</option>
                <option value="company_move">Company Move</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Location</label>
            <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
              value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}>
              <option value="">No location</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onDelete} className="px-3 py-2 text-[#ef4444] text-xs hover:bg-[#1a1a1a] rounded-lg">Delete Day</button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
          <button onClick={() => onSave({ ...form, locationId: form.locationId || null, date: form.date || null })}
            className="px-4 py-2 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Scene Modal ───────────────────────────────────────────────────────────
function AddSceneModal({ form, onChange, onSave, onClose, isPending }: {
  form: { sceneNumber: string; sceneName: string; intExt: string; dayNight: string; pageCount: string; synopsis: string };
  onChange: (f: typeof form) => void; onSave: () => void; onClose: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 w-full max-w-md">
        <h3 className="text-white font-semibold mb-4">Add Scene</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] block mb-1">Scene #</label>
              <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                placeholder="1, 1A, 12B..." value={form.sceneNumber} onChange={e => onChange({ ...form, sceneNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-[#888] block mb-1">Page Count</label>
              <input type="number" step="0.125" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.pageCount} onChange={e => onChange({ ...form, pageCount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Scene Name</label>
            <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
              placeholder="COFFEE SHOP - MEETING" value={form.sceneName} onChange={e => onChange({ ...form, sceneName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] block mb-1">INT / EXT</label>
              <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.intExt} onChange={e => onChange({ ...form, intExt: e.target.value })}>
                <option value="INT">INT</option><option value="EXT">EXT</option><option value="INT/EXT">INT/EXT</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#888] block mb-1">DAY / NIGHT</label>
              <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                value={form.dayNight} onChange={e => onChange({ ...form, dayNight: e.target.value })}>
                <option value="DAY">DAY</option><option value="NIGHT">NIGHT</option><option value="DAWN">DAWN</option><option value="DUSK">DUSK</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Synopsis (optional)</label>
            <textarea className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b] resize-none"
              rows={2} value={form.synopsis} onChange={e => onChange({ ...form, synopsis: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
          <button onClick={onSave} disabled={!form.sceneNumber || !form.sceneName || isPending}
            className="flex-1 py-2 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg disabled:opacity-50">
            {isPending ? "Adding..." : "Add Scene"}
          </button>
        </div>
      </div>
    </div>
  );
}
