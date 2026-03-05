"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  genre: string | null;
  format: string;
  budgetCap: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count: { scenes: number; shootDays: number };
}

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", genre: "", format: "film", budgetCap: "", currency: "INR",
  });

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, budgetCap: Number(data.budgetCap) || 0 }),
      }).then(r => r.json()),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${project.id}/schedule`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#f59e0b] rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">ShotFlow</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#f59e0b] text-black text-sm font-semibold rounded-lg hover:bg-[#d97706] transition-colors"
        >
          + New Project
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-[#888] text-sm mt-1">Manage your film and TV productions</p>
        </div>

        {isLoading ? (
          <div className="text-[#666] text-sm">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-[#2a2a2a] rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <p className="text-[#888] mb-4">No projects yet. Create your first production.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#f59e0b] text-black text-sm font-semibold rounded-lg"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map(project => (
              <div key={project.id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 flex items-center justify-between group hover:border-[#333] transition-colors">
                <Link href={`/projects/${project.id}/schedule`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-semibold">{project.title}</h3>
                    <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded uppercase tracking-wide">
                      {project.format}
                    </span>
                    {project.genre && (
                      <span className="text-[10px] text-[#666]">{project.genre}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#666]">
                    <span>{project._count.shootDays} shoot days</span>
                    <span>{project._count.scenes} scenes</span>
                    <span className="text-[#888]">
                      Budget: {formatCurrency(project.budgetCap, project.currency)}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/projects/${project.id}/schedule`}
                    className="px-3 py-1.5 bg-[#1a1a1a] text-[#ccc] text-xs rounded-lg hover:bg-[#222] transition-colors"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Delete this project?")) deleteMutation.mutate(project.id);
                    }}
                    className="px-3 py-1.5 text-[#ef4444] text-xs rounded-lg hover:bg-[#1a1a1a] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#222] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#888] block mb-1">Project Title *</label>
                <input
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                  placeholder="e.g. The Last Frame"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Format</label>
                  <select
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.format}
                    onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                  >
                    <option value="film">Feature Film</option>
                    <option value="series">Series</option>
                    <option value="short">Short Film</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Genre</label>
                  <input
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    placeholder="Drama, Thriller..."
                    value={form.genre}
                    onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] block mb-1">Budget Cap</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    placeholder="5000000"
                    value={form.budgetCap}
                    onChange={e => setForm(f => ({ ...f, budgetCap: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1">Currency</label>
                  <select
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-[#1a1a1a] text-[#888] text-sm rounded-lg hover:bg-[#222]"
              >
                Cancel
              </button>
              <button
                onClick={() => form.title && createMutation.mutate(form)}
                disabled={!form.title || createMutation.isPending}
                className="flex-1 py-2 bg-[#f59e0b] text-black text-sm font-semibold rounded-lg hover:bg-[#d97706] disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
