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
const TYPE_COLORS: Record<string, string> = { studio: "var(--blue)", practical: "var(--green)", outdoor: "var(--amber)" };

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
      <div className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Locations</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{locations.length} locations</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-black text-xs font-semibold rounded-lg" style={{ background: 'var(--amber)' }}>+ Add Location</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {locations.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>No locations yet.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_90px_80px_60px_60px_60px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              <span>Name</span><span>Type</span><span>Daily Rental</span><span>Permit</span><span>Distance</span><span>Power</span><span></span>
            </div>
            {locations.map(loc => (
              <div key={loc.id} className="grid grid-cols-[1fr_80px_90px_80px_60px_60px_60px] gap-3 items-center rounded-xl px-4 py-3 group" style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{loc.name}</p>
                  {loc.address && <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{loc.address}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: `color-mix(in srgb, ${TYPE_COLORS[loc.locationType] || 'var(--text-secondary)'} 13%, transparent)`, color: TYPE_COLORS[loc.locationType] || 'var(--text-secondary)' }}>
                  {loc.locationType}
                </span>
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(loc.dailyRentalCost, currency)}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(loc.permitCost, currency)}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{loc.travelDistanceKm > 0 ? `${loc.travelDistanceKm}km` : "—"}</span>
                <div className="flex gap-1">
                  {loc.hasPower && <span className="text-[10px]" style={{ color: 'var(--green)' }}>⚡</span>}
                  {loc.hasParking && <span className="text-[10px]" style={{ color: 'var(--blue)' }}>P</span>}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(loc)} style={{ color: 'var(--text-tertiary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => { if (confirm("Delete location?")) deleteMutation.mutate(loc.id); }} style={{ color: 'var(--text-tertiary)' }}>
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
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-default)' }}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{editId ? "Edit Location" : "Add Location"}</h3>
            <div className="space-y-3">
              <div>
                <label className="sf-label block mb-1">Location Name *</label>
                <input className="sf-input w-full"
                  placeholder="Studio A, Bandra Beach..."
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="sf-label block mb-1">Type</label>
                  <select className="sf-input w-full"
                    value={form.locationType} onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))}>
                    {LOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sf-label block mb-1">Travel Distance (km)</label>
                  <input type="number" className="sf-input w-full"
                    value={form.travelDistanceKm} onChange={e => setForm(f => ({ ...f, travelDistanceKm: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="sf-label block mb-1">Daily Rental</label>
                  <input type="number" className="sf-input w-full"
                    placeholder="25000" value={form.dailyRentalCost} onChange={e => setForm(f => ({ ...f, dailyRentalCost: e.target.value }))} />
                </div>
                <div>
                  <label className="sf-label block mb-1">Permit Cost</label>
                  <input type="number" className="sf-input w-full"
                    placeholder="5000" value={form.permitCost} onChange={e => setForm(f => ({ ...f, permitCost: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="sf-label block mb-1">Address</label>
                <input className="sf-input w-full"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasPower} onChange={e => setForm(f => ({ ...f, hasPower: e.target.checked }))} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Has Power</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasParking} onChange={e => setForm(f => ({ ...f, hasParking: e.target.checked }))} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Has Parking</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 py-2 text-xs rounded-lg" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button
                onClick={() => form.name && saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
                className="flex-1 py-2 text-black text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: 'var(--amber)' }}
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
