"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Film, Calendar, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Project {
  id: string;
  title: string;
  genre: string | null;
  format: string;
  currency: string;
  budgetCap: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    scenes: number;
    shootDays: number;
  };
}

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setConfirmDelete(null);
      toast("Project deleted", "success");
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    },
  });

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--border-strong)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)" }}>
            Projects
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="sf-btn sf-btn--primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 24px",
            background: "var(--bg-surface-2)",
            border: "1px dashed var(--border-default)",
            borderRadius: 16,
          }}
        >
          <Film size={48} strokeWidth={1.2} style={{ color: "var(--text-tertiary)", marginBottom: 16 }} />
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            No projects yet
          </h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 24 }}>
            Create your first project to get started.
          </p>
          <Link href="/projects/new" className="sf-btn sf-btn--primary">
            <Plus size={16} style={{ marginRight: 6 }} />
            Create Project
          </Link>
        </div>
      ) : (
        /* Project grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {projects.map((project) => (
            <div
              key={project.id}
              style={{
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: 20,
                transition: "all 0.15s",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={() => router.push(`/projects/${project.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.background = "var(--bg-surface-3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.background = "var(--bg-surface-2)";
              }}
            >
              {/* Delete button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(project);
                }}
                title="Delete project"
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--red, #ef4444)";
                  e.currentTarget.style.borderColor = "var(--red, #ef4444)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-tertiary)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <Trash2 size={13} />
              </button>

              {/* Title */}
              <div style={{ marginBottom: 12, paddingRight: 36 }}>
                <h3
                  style={{
                    fontSize: "var(--text-md)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.title || "Untitled Project"}
                </h3>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  {project.genre || "Unscripted"} · {project.format || "feature"}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  <FileText size={12} />
                  <span>
                    <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {project._count?.scenes || 0}
                    </span>{" "}
                    scenes
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  <Calendar size={12} />
                  <span>
                    <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {project._count?.shootDays || 0}
                    </span>{" "}
                    days
                  </span>
                </div>
              </div>

              {/* Updated */}
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 12 }}>
                Updated {formatDate(project.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Delete project?
            </h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 20 }}>
              This will permanently delete <strong style={{ color: "var(--text-primary)" }}>{confirmDelete.title || "Untitled"}</strong> along with all its scenes, cast, locations, schedule, and budget. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="sf-btn sf-btn--secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sf-btn sf-btn--danger"
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
