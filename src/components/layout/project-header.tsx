"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Clapperboard, Settings2 } from "lucide-react";
import { getProjectRouteMeta } from "@/lib/project-navigation";

interface ProjectHeaderProps {
  projectId: string;
  project?: {
    title?: string;
    budgetCap?: number;
    scenes?: Array<{ pageCount: number }>;
    shootDays?: Array<{ scenes?: Array<{ pageCount: number }> }>;
  };
  onOpenSidebar: () => void;
}

export function ProjectHeader({ projectId, project, onOpenSidebar }: ProjectHeaderProps) {
  const pathname = usePathname();
  const routeMeta = getProjectRouteMeta(pathname);

  const unscheduledScenes = project?.scenes ?? [];
  const scheduledDays = project?.shootDays ?? [];
  const scheduledScenes = scheduledDays.flatMap((day) => day.scenes ?? []);
  const totalScenes = unscheduledScenes.length + scheduledScenes.length;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 48,
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-1)",
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
        <span>ShotFlow</span>
        <span style={{ color: "var(--text-tertiary)" }}>→</span>
        <span>{project?.title || "Project"}</span>
        <span style={{ color: "var(--text-tertiary)" }}>→</span>
        <span style={{ color: "var(--text-primary)" }}>{routeMeta.label}</span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          <Clapperboard size={13} />
          <span>{totalScenes} scenes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          <CalendarRange size={13} />
          <span>{scheduledDays.length} days</span>
        </div>
        <Link
          href={`/projects/${projectId}/settings`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "var(--text-sm)", color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <Settings2 size={14} />
          <span>Settings</span>
        </Link>
      </div>
    </header>
  );
}
