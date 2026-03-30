"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WarningsBell } from "@/components/shared/warnings-bell";

interface PipelineNavProps {
  projectId: string;
  projectTitle?: string;
}

const STEPS = [
  { key: "script", label: "Script", segment: "script" },
  { key: "breakdown", label: "Breakdown", segment: "breakdown" },
  { key: "scenes", label: "Scene List", segment: "scenes" },
  { key: "schedule", label: "Schedule", segment: "schedule" },
  { key: "export", label: "Export", segment: "export" },
];

export function PipelineNav({ projectId, projectTitle }: PipelineNavProps) {
  const pathname = usePathname();

  const activeIdx = STEPS.findIndex((s) => pathname.includes(`/projects/${projectId}/${s.segment}`));

  return (
    <header
      className="h-[52px] flex items-center px-5 gap-6 flex-shrink-0"
      style={{
        background: "var(--bg-surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <Link href="/projects" className="flex items-center gap-2.5 mr-4 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--blue-primary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <span style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
          ShotFlow
        </span>
      </Link>

      {/* Pipeline Steps */}
      <nav className="flex items-center gap-1 flex-1 justify-center">
        {STEPS.map((step, i) => {
          const isActive = i === activeIdx;
          const isCompleted = activeIdx > i;
          const href = `/projects/${projectId}/${step.segment}`;

          return (
            <div key={step.key} className="flex items-center">
              {i > 0 && (
                <svg width="16" height="16" viewBox="0 0 16 16" className="mx-1" style={{ color: "var(--text-tertiary)" }}>
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <Link href={href} className={`pipeline-step ${isActive ? "active" : isCompleted ? "completed" : ""}`}>
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="var(--green)" fillOpacity="0.15" stroke="var(--green)" strokeWidth="1.5" />
                    <path d="M5 8l2 2 4-4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="pipeline-dot" />
                )}
                {step.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Right: Project title + actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {projectTitle && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {projectTitle}
          </span>
        )}
        <WarningsBell />
        <Link
          href={`/projects/${projectId}/settings`}
          className="btn btn-ghost btn-icon"
          style={{ color: "var(--text-tertiary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        <Link href="/projects" className="btn btn-ghost" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          + New Project
        </Link>
      </div>
    </header>
  );
}
