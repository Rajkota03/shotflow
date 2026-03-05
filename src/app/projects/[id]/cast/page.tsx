"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface CastMember {
  id: string; name: string; characterName: string | null; roleType: string;
  dayRate: number; travelRequired: boolean; notes: string | null;
  sceneLinks: { scene: { id: string; sceneNumber: string; sceneName: string } }[];
}
interface Project { id: string; currency: string; }

const ROLE_TYPES = ["lead", "supporting", "day_player", "extra"];
const ROLE_COLORS: Record<string, string> = {
  lead: "#f59e0b", supporting: "#3b82f6", day_player: "#10b981", extra: "#6b7280"
};

export default function CastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", characterName: "", roleType: "lead", dayRate: "", travelRequired: false, notes: "" });

  const { data: project } = useQuery<Project>({ queryKey: ["project", id], queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()) });
  const { data: cast = [] } = useQuery<CastMember[]>({
    queryKey: ["cast", id],
    queryFn: () => fetch(`/api/projects/${id}/cast`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const body = { ...data, dayRate: Number(data.dayRate) || 0 };
      if (editId) {
        return fetch(`/api/projects/${id}/cast/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
      }
      return fetch(`/api/projects/${id}/cast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cast", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      refreshBudget(id);
      setShowAdd(false); setEditId(null);
      setForm({ name: "", characterName: "", roleType: "lead", dayRate: "", travelRequired: false, notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (castId: string) => fetch(`/api/projects/${id}/cast/${castId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cast", id] }); refreshBudget(id); },
  });

  const startEdit = (member: CastMember) => {
    setForm({ name: member.name, characterName: member.characterName || "", roleType: member.roleType, dayRate: String(member.dayRate), travelRequired: member.travelRequired, notes: member.notes || "" });
    setEditId(member.id);
    setShowAdd(true);
  };

  const currency = project?.currency || "INR";
  const totalDailyRate = cast.reduce((s, c) => s + c.dayRate, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-semibold text-sm">Cast</h2>
          <p className="text-[#555] text-xs mt-0.5">{cast.length} members · {formatCurrency(totalDailyRate, currency)}/day total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg hover:bg-[#d97706]">
          + Add Cast
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cast.length === 0 ? (
          <div className="text-center py-12 text-[#555] text-sm">No cast members yet.</div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_80px_100px_80px_60px] gap-3 px-4 py-2 text-[10px] text-[#444] uppercase tracking-wider">
              <span>Name / Character</span><span>Role</span><span>Day Rate</span><span>Scenes</span><span>Travel</span><span></span>
            </div>
            {cast.map(member => (
              <div key={member.id} className="grid grid-cols-[1fr_100px_80px_100px_80px_60px] gap-3 items-center bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3 hover:border-[#222] group">
                <div>
                  <p className="text-white text-sm font-medium">{member.name}</p>
                  {member.characterName && <p className="text-[#555] text-xs">{member.characterName}</p>}
                </div>
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: `${ROLE_COLORS[member.roleType]}22`, color: ROLE_COLORS[member.roleType] }}>
                    {member.roleType.replace("_", " ")}
                  </span>
                </div>
                <span className="text-[#ccc] text-sm font-mono">{formatCurrency(member.dayRate, currency)}</span>
                <div className="flex flex-wrap gap-1">
                  {member.sceneLinks.slice(0, 3).map(l => (
                    <span key={l.scene.id} className="text-[10px] bg-[#1a1a1a] text-[#888] px-1.5 py-0.5 rounded">
                      {l.scene.sceneNumber}
                    </span>
                  ))}
                  {member.sceneLinks.length > 3 && (
                    <span className="text-[10px] text-[#555]">+{member.sceneLinks.length - 3}</span>
                  )}
                </div>
                <span className="text-[#555] text-xs">{member.travelRequired ? "Yes" : "—"}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(member)} className="text-[#555] hover:text-[#888]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => { if (confirm("Remove cast member?")) deleteMutation.mutate(member.id); }} className="text-[#555] hover:text-[#ef4444]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#222] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-4">{editId ? "Edit Cast Member" : "Add Cast Member"}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Actor Name *</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Character Name</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.characterName} onChange={e => setForm(f => ({ ...f, characterName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Role Type</label>
                  <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.roleType} onChange={e => setForm(f => ({ ...f, roleType: e.target.value }))}>
                    {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Day Rate ({currency === "INR" ? "₹" : "$"})</label>
                  <input type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    placeholder="50000" value={form.dayRate} onChange={e => setForm(f => ({ ...f, dayRate: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.travelRequired} onChange={e => setForm(f => ({ ...f, travelRequired: e.target.checked }))} />
                  <span className="text-xs text-[#888]">Travel Required</span>
                </label>
              </div>
              <div>
                <label className="text-xs text-[#888] block mb-1">Notes</label>
                <textarea className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b] resize-none"
                  rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
              <button
                onClick={() => form.name && saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
                className="flex-1 py-2 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Cast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
