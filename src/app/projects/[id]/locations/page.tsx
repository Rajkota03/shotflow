"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";

interface Location {
  id: string; name: string; address: string | null; locationType: string;
  dailyRentalCost: number; permitCost: number; travelDistanceKm: number;
  hasPower: boolean; hasParking: boolean; notes: string | null;
}
interface Project { id: string; currency: string; }

const LOC_TYPES = ["studio", "practical", "outdoor"];
const TYPE_COLORS: Record<string, string> = { studio: "#3b82f6", practical: "#10b981", outdoor: "#f59e0b" };

export default function LocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", locationType: "studio", dailyRentalCost: "", permitCost: "",
    travelDistanceKm: "", hasPower: true, hasParking: true, notes: "",
  });

  const { data: project } = useQuery<Project>({ queryKey: ["project", id], queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()) });
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations", id],
    queryFn: () => fetch(`/api/projects/${id}/locations`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const body = {
        ...data,
        dailyRentalCost: Number(data.dailyRentalCost) || 0,
        permitCost: Number(data.permitCost) || 0,
        travelDistanceKm: Number(data.travelDistanceKm) || 0,
      };
      if (editId) return fetch(`/api/projects/${id}/locations/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
      return fetch(`/api/projects/${id}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      refreshBudget(id);
      setShowAdd(false); setEditId(null);
      setForm({ name: "", address: "", locationType: "studio", dailyRentalCost: "", permitCost: "", travelDistanceKm: "", hasPower: true, hasParking: true, notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (locId: string) => fetch(`/api/projects/${id}/locations/${locId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", id] }); refreshBudget(id); },
  });

  const startEdit = (loc: Location) => {
    setForm({
      name: loc.name, address: loc.address || "", locationType: loc.locationType,
      dailyRentalCost: String(loc.dailyRentalCost), permitCost: String(loc.permitCost),
      travelDistanceKm: String(loc.travelDistanceKm), hasPower: loc.hasPower, hasParking: loc.hasParking, notes: loc.notes || "",
    });
    setEditId(loc.id); setShowAdd(true);
  };

  const currency = project?.currency || "INR";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-semibold text-sm">Locations</h2>
          <p className="text-[#555] text-xs mt-0.5">{locations.length} locations</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg">+ Add Location</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {locations.length === 0 ? (
          <div className="text-center py-12 text-[#555] text-sm">No locations yet.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_90px_80px_60px_60px_60px] gap-3 px-4 py-2 text-[10px] text-[#444] uppercase tracking-wider">
              <span>Name</span><span>Type</span><span>Daily Rental</span><span>Permit</span><span>Distance</span><span>Power</span><span></span>
            </div>
            {locations.map(loc => (
              <div key={loc.id} className="grid grid-cols-[1fr_80px_90px_80px_60px_60px_60px] gap-3 items-center bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3 hover:border-[#222] group">
                <div>
                  <p className="text-white text-sm font-medium">{loc.name}</p>
                  {loc.address && <p className="text-[#555] text-xs truncate">{loc.address}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: `${TYPE_COLORS[loc.locationType] || "#666"}22`, color: TYPE_COLORS[loc.locationType] || "#888" }}>
                  {loc.locationType}
                </span>
                <span className="text-[#ccc] text-sm font-mono">{formatCurrency(loc.dailyRentalCost, currency)}</span>
                <span className="text-[#888] text-xs font-mono">{formatCurrency(loc.permitCost, currency)}</span>
                <span className="text-[#555] text-xs">{loc.travelDistanceKm > 0 ? `${loc.travelDistanceKm}km` : "—"}</span>
                <div className="flex gap-1">
                  {loc.hasPower && <span className="text-[#10b981] text-[10px]">⚡</span>}
                  {loc.hasParking && <span className="text-[#3b82f6] text-[10px]">P</span>}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(loc)} className="text-[#555] hover:text-[#888]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => { if (confirm("Delete location?")) deleteMutation.mutate(loc.id); }} className="text-[#555] hover:text-[#ef4444]">
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
            <h3 className="text-white font-semibold mb-4">{editId ? "Edit Location" : "Add Location"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#888] block mb-1">Location Name *</label>
                <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                  placeholder="Studio A, Bandra Beach..."
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Type</label>
                  <select className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.locationType} onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))}>
                    {LOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Travel Distance (km)</label>
                  <input type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.travelDistanceKm} onChange={e => setForm(f => ({ ...f, travelDistanceKm: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Daily Rental</label>
                  <input type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    placeholder="25000" value={form.dailyRentalCost} onChange={e => setForm(f => ({ ...f, dailyRentalCost: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Permit Cost</label>
                  <input type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    placeholder="5000" value={form.permitCost} onChange={e => setForm(f => ({ ...f, permitCost: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#888] block mb-1">Address</label>
                <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasPower} onChange={e => setForm(f => ({ ...f, hasPower: e.target.checked }))} />
                  <span className="text-xs text-[#888]">Has Power</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasParking} onChange={e => setForm(f => ({ ...f, hasParking: e.target.checked }))} />
                  <span className="text-xs text-[#888]">Has Parking</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 py-2 bg-[#1a1a1a] text-[#888] text-xs rounded-lg">Cancel</button>
              <button
                onClick={() => form.name && saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
                className="flex-1 py-2 bg-[#f59e0b] text-black text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
