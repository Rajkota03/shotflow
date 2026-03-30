"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface EquipmentItem {
  id: string; name: string; category: string; dailyRental: number;
  vendor: string | null; quantityAvailable: number; notes: string | null;
  dayLinks: { shootDay: { id: string; dayNumber: number } }[];
}
interface Project { id: string; currency: string; }

const CATEGORIES = ["camera", "lighting", "grip", "sound"];
const CAT_COLORS: Record<string, string> = {
  camera: "var(--dept-camera)", lighting: "var(--dept-lighting)", grip: "var(--dept-grip)", sound: "var(--dept-sound)",
};

export default function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [form, setForm] = useState({
    name: "", category: "camera", dailyRental: "", vendor: "", quantityAvailable: "1", notes: "",
  });

  const { data: project } = useQuery<Project>({ queryKey: ["project", id], queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()) });
  const { data: equipment = [] } = useQuery<EquipmentItem[]>({
    queryKey: ["equipment", id],
    queryFn: () => fetch(`/api/projects/${id}/equipment`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const body = {
        ...data,
        dailyRental: Number(data.dailyRental) || 0,
        quantityAvailable: Number(data.quantityAvailable) || 1,
      };
      if (editId) return fetch(`/api/projects/${id}/equipment/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
      return fetch(`/api/projects/${id}/equipment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      refreshBudget(id);
      setShowAdd(false); setEditId(null);
      setForm({ name: "", category: "camera", dailyRental: "", vendor: "", quantityAvailable: "1", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eqId: string) => fetch(`/api/projects/${id}/equipment/${eqId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment", id] }); refreshBudget(id); },
  });

  const startEdit = (item: EquipmentItem) => {
    setForm({
      name: item.name, category: item.category, dailyRental: String(item.dailyRental),
      vendor: item.vendor || "", quantityAvailable: String(item.quantityAvailable), notes: item.notes || "",
    });
    setEditId(item.id); setShowAdd(true);
  };

  const currency = project?.currency || "INR";
  const filtered = filterCat === "all" ? equipment : equipment.filter(e => e.category === filterCat);
  const totalDailyRental = equipment.reduce((s, e) => s + e.dailyRental * e.quantityAvailable, 0);
  const catCounts = equipment.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {});

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Equipment</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{equipment.length} items · {formatCurrency(totalDailyRental, currency)}/day total rental</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ background: "var(--amber)", color: "var(--bg-void)" }}>
          + Add Equipment
        </button>
      </div>

      {/* Category Filter */}
      {equipment.length > 0 && (
        <div className="px-4 py-2 flex gap-1.5 flex-shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setFilterCat("all")}
            className="px-2.5 py-1 text-[10px] rounded-full font-medium transition-colors"
            style={filterCat === "all" ? { background: "var(--amber-subtle)", color: "var(--amber)" } : { color: "var(--text-tertiary)" }}
          >All ({equipment.length})</button>
          {Object.entries(catCounts).map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className="px-2.5 py-1 text-[10px] rounded-full font-medium capitalize transition-colors"
              style={filterCat === cat ? { background: `color-mix(in srgb, ${CAT_COLORS[cat] || "var(--text-secondary)"} 20%, transparent)`, color: CAT_COLORS[cat] || "var(--text-secondary)" } : { color: "var(--text-tertiary)" }}
            >{cat} ({count})</button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {equipment.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>No equipment yet.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_90px_90px_60px_80px_80px_60px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              <span>Name / Vendor</span><span>Category</span><span>Daily Rental</span><span>Qty</span><span>Shoot Days</span><span>Total Cost</span><span></span>
            </div>
            {filtered.map(item => {
              const daysUsed = item.dayLinks.length;
              const totalCost = item.dailyRental * daysUsed;
              return (
                <div key={item.id} className="grid grid-cols-[1fr_90px_90px_60px_80px_80px_60px] gap-3 items-center rounded-xl px-4 py-3 group" style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    {item.vendor && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{item.vendor}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: `color-mix(in srgb, ${CAT_COLORS[item.category] || "var(--text-secondary)"} 13%, transparent)`, color: CAT_COLORS[item.category] || "var(--text-secondary)" }}>
                    {item.category}
                  </span>
                  <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(item.dailyRental, currency)}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.quantityAvailable}</span>
                  <div className="flex flex-wrap gap-1">
                    {item.dayLinks.slice(0, 3).map(l => (
                      <span key={l.shootDay.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-surface-3)", color: "var(--text-secondary)" }}>
                        D{l.shootDay.dayNumber}
                      </span>
                    ))}
                    {daysUsed > 3 && <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>+{daysUsed - 3}</span>}
                    {daysUsed === 0 && <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>—</span>}
                  </div>
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    {totalCost > 0 ? formatCurrency(totalCost, currency) : "—"}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(item)} style={{ color: "var(--text-tertiary)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onClick={() => { if (confirm("Delete equipment?")) deleteMutation.mutate(item.id); }} style={{ color: "var(--text-tertiary)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "var(--bg-overlay)" }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}>
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{editId ? "Edit Equipment" : "Add Equipment"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Equipment Name *</label>
                <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  placeholder="ARRI Alexa Mini, Aputure 600d..."
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
                  <select className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Quantity</label>
                  <input type="number" min="1" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    value={form.quantityAvailable} onChange={e => setForm(f => ({ ...f, quantityAvailable: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Daily Rental ({currency === "INR" ? "₹" : "$"})</label>
                  <input type="number" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="25000" value={form.dailyRental} onChange={e => setForm(f => ({ ...f, dailyRental: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Vendor</label>
                  <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="Rental house name"
                    value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
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
                onClick={() => form.name && saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: "var(--amber)", color: "var(--bg-void)" }}
              >
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Equipment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
