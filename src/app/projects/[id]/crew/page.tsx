"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface CrewMember {
  id: string; name: string; department: string; role: string;
  dayRate: number; overtimeRate: number; contractedDays: number; notes: string | null;
}
interface Project { id: string; currency: string; }

const DEPARTMENTS = ["production", "camera", "lighting", "grip", "sound", "art", "costume", "makeup", "post"];
const DEPT_COLORS: Record<string, string> = {
  production: "var(--dept-production)", camera: "var(--dept-camera)", lighting: "var(--dept-lighting)", grip: "var(--dept-grip)",
  sound: "var(--dept-sound)", art: "var(--dept-art)", costume: "var(--dept-costume)", makeup: "var(--dept-makeup)", post: "var(--dept-post)",
};

export default function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [form, setForm] = useState({
    name: "", department: "production", role: "", dayRate: "", overtimeRate: "", contractedDays: "", notes: "",
  });

  const { data: project } = useQuery<Project>({ queryKey: ["project", id], queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()) });
  const { data: crew = [] } = useQuery<CrewMember[]>({
    queryKey: ["crew", id],
    queryFn: () => fetch(`/api/projects/${id}/crew`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const body = {
        ...data,
        dayRate: Number(data.dayRate) || 0,
        overtimeRate: Number(data.overtimeRate) || 0,
        contractedDays: Number(data.contractedDays) || 0,
      };
      if (editId) return fetch(`/api/projects/${id}/crew/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
      return fetch(`/api/projects/${id}/crew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crew", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      refreshBudget(id);
      setShowAdd(false); setEditId(null);
      setForm({ name: "", department: "production", role: "", dayRate: "", overtimeRate: "", contractedDays: "", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (crewId: string) => fetch(`/api/projects/${id}/crew/${crewId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew", id] }); refreshBudget(id); },
  });

  const startEdit = (member: CrewMember) => {
    setForm({
      name: member.name, department: member.department, role: member.role,
      dayRate: String(member.dayRate), overtimeRate: String(member.overtimeRate),
      contractedDays: String(member.contractedDays), notes: member.notes || "",
    });
    setEditId(member.id); setShowAdd(true);
  };

  const currency = project?.currency || "INR";
  const filtered = filterDept === "all" ? crew : crew.filter(c => c.department === filterDept);
  const totalDailyRate = crew.reduce((s, c) => s + c.dayRate, 0);
  const deptCounts = crew.reduce<Record<string, number>>((acc, c) => { acc[c.department] = (acc[c.department] || 0) + 1; return acc; }, {});

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Crew</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{crew.length} members · {formatCurrency(totalDailyRate, currency)}/day total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ background: "var(--amber)", color: "var(--bg-void)" }}>
          + Add Crew
        </button>
      </div>

      {/* Department Filter */}
      {crew.length > 0 && (
        <div className="px-4 py-2 flex gap-1.5 flex-shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setFilterDept("all")}
            className="px-2.5 py-1 text-[10px] rounded-full font-medium transition-colors"
            style={filterDept === "all" ? { background: "var(--amber-subtle)", color: "var(--amber)" } : { color: "var(--text-tertiary)" }}
          >All ({crew.length})</button>
          {Object.entries(deptCounts).map(([dept, count]) => (
            <button
              key={dept}
              onClick={() => setFilterDept(dept)}
              className="px-2.5 py-1 text-[10px] rounded-full font-medium capitalize transition-colors"
              style={filterDept === dept ? { background: `color-mix(in srgb, ${DEPT_COLORS[dept] || "var(--text-secondary)"} 20%, transparent)`, color: DEPT_COLORS[dept] || "var(--text-secondary)" } : { color: "var(--text-tertiary)" }}
            >{dept} ({count})</button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {crew.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>No crew members yet.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_100px_80px_80px_80px_60px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              <span>Name / Role</span><span>Department</span><span>Day Rate</span><span>OT Rate</span><span>Contracted</span><span>Total Cost</span><span></span>
            </div>
            {filtered.map(member => (
              <div key={member.id} className="grid grid-cols-[1fr_100px_100px_80px_80px_80px_60px] gap-3 items-center rounded-xl px-4 py-3 group" style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{member.role}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: `color-mix(in srgb, ${DEPT_COLORS[member.department] || "var(--text-secondary)"} 13%, transparent)`, color: DEPT_COLORS[member.department] || "var(--text-secondary)" }}>
                  {member.department}
                </span>
                <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(member.dayRate, currency)}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{member.overtimeRate > 0 ? formatCurrency(member.overtimeRate, currency) : "—"}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{member.contractedDays > 0 ? `${member.contractedDays} days` : "—"}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                  {member.contractedDays > 0 ? formatCurrency(member.dayRate * member.contractedDays, currency) : "—"}
                </span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(member)} style={{ color: "var(--text-tertiary)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => { if (confirm("Remove crew member?")) deleteMutation.mutate(member.id); }} style={{ color: "var(--text-tertiary)" }}>
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "var(--bg-overlay)" }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}>
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{editId ? "Edit Crew Member" : "Add Crew Member"}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
                  <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Role *</label>
                  <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="Director of Photography"
                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Department</label>
                <select className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Day Rate ({currency === "INR" ? "₹" : "$"})</label>
                  <input type="number" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="15000" value={form.dayRate} onChange={e => setForm(f => ({ ...f, dayRate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>OT Rate</label>
                  <input type="number" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="2000" value={form.overtimeRate} onChange={e => setForm(f => ({ ...f, overtimeRate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Contracted Days</label>
                  <input type="number" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="30" value={form.contractedDays} onChange={e => setForm(f => ({ ...f, contractedDays: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label>
                <textarea className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 py-2 text-xs rounded-lg" style={{ background: "var(--bg-surface-3)", color: "var(--text-secondary)" }}>Cancel</button>
              <button
                onClick={() => form.name && form.role && saveMutation.mutate(form)}
                disabled={!form.name || !form.role || saveMutation.isPending}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: "var(--amber)", color: "var(--bg-void)" }}
              >
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Crew"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
