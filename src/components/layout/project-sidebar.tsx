"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsUpDown, LogOut, Menu, Plus, X } from "lucide-react";
import { PROJECT_NAV_SECTIONS } from "@/lib/project-navigation";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  projectId: string;
  project?: {
    title?: string;
    genre?: string | null;
    format?: string | null;
  };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function ProjectSidebar({
  projectId,
  project,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: ProjectSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: allProjects } = useQuery<{ id: string; title: string; genre: string | null; format: string | null }[]>({
    queryKey: ["projects-list"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const aside = (
    <aside
      className={cn(
        "project-sidebar",
        collapsed ? "is-collapsed" : "is-expanded",
        mobileOpen ? "is-mobile-open" : ""
      )}
    >
      <div className="project-sidebar__inner">
        <div className="project-sidebar__header">
          <div className="project-sidebar__brand">
            <div
              className="project-sidebar__mark"
              onClick={() => collapsed && onCollapsedChange(false)}
              style={collapsed ? { cursor: "pointer" } : undefined}
              title={collapsed ? "Expand sidebar" : undefined}
            >
              SF
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="project-sidebar__brand-title">ShotFlow</div>
                <div className="project-sidebar__brand-subtitle">Production planning system</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="project-sidebar__icon-button lg:hidden"
                onClick={() => onMobileOpenChange(false)}
                aria-label="Close sidebar"
              >
                <X size={16} />
              </button>
              <button
                type="button"
                className="project-sidebar__icon-button hidden lg:inline-flex"
                onClick={() => onCollapsedChange(true)}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="project-sidebar__project-wrapper">
          <button
            type="button"
            className="project-sidebar__project"
            onClick={() => {
              if (collapsed) {
                onCollapsedChange(false);
              } else {
                setSwitcherOpen(!switcherOpen);
              }
            }}
          >
            <div className="project-sidebar__project-ring" />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="project-sidebar__project-label">Active project</div>
                  <div className="project-sidebar__project-title">{project?.title || "Untitled project"}</div>
                  <div className="project-sidebar__project-meta">
                    {project?.genre || "Unscripted"} · {project?.format || "feature"}
                  </div>
                </div>
                <ChevronsUpDown size={14} className="project-sidebar__switcher-icon" />
              </>
            )}
          </button>

          {switcherOpen && !collapsed && allProjects && (
            <div className="project-switcher">
              {allProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn("project-switcher__item", p.id === projectId && "is-active")}
                  onClick={() => {
                    setSwitcherOpen(false);
                    if (p.id !== projectId) {
                      // Navigate to same page in new project, fallback to overview
                      const currentSegment = pathname.split(`/projects/${projectId}/`)[1] || "";
                      router.push(`/projects/${p.id}/${currentSegment}`);
                    }
                  }}
                >
                  <div className="project-switcher__dot" />
                  <div className="min-w-0 flex-1">
                    <div className="project-switcher__name">{p.title || "Untitled"}</div>
                    <div className="project-switcher__meta">{p.genre || "Unscripted"} · {p.format || "feature"}</div>
                  </div>
                  {p.id === projectId && <span className="project-switcher__badge">Current</span>}
                </button>
              ))}
              <Link
                href="/projects"
                className="project-switcher__item project-switcher__item--all"
                onClick={() => setSwitcherOpen(false)}
              >
                <Plus size={14} />
                <span>All Projects</span>
              </Link>
            </div>
          )}
        </div>

        <nav className="project-sidebar__nav">
          {PROJECT_NAV_SECTIONS.map((section) => (
            <div key={section.label} className="project-sidebar__section">
              {!collapsed && <div className="project-sidebar__section-label">{section.label}</div>}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const href = item.segment ? `/projects/${projectId}/${item.segment}` : `/projects/${projectId}`;
                  const Icon = item.icon;
                  const fullPath = `/projects/${projectId}/${item.segment}`;
                  const isActive = item.segment
                    ? pathname === fullPath || pathname.startsWith(fullPath + "/")
                    : pathname === `/projects/${projectId}`;

                  return (
                    <Link
                      key={item.segment || "overview"}
                      href={href}
                      title={collapsed ? item.label : undefined}
                      className={cn("project-sidebar__link", isActive && "is-active")}
                    >
                      <span className="project-sidebar__link-icon">
                        <Icon size={17} />
                      </span>
                      {!collapsed && (
                        <span className="min-w-0">
                          <span className="project-sidebar__link-label">{item.shortLabel}</span>
                          <span className="project-sidebar__link-description">{item.description}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="project-sidebar__footer">
          <Link href="/projects/new" className="project-sidebar__back-link">
            <Plus size={14} />
            {!collapsed && <span>New Project</span>}
          </Link>
          <button
            type="button"
            className="project-sidebar__back-link"
            onClick={async () => {
              await fetch("/api/auth/signout", { method: "POST" });
              window.location.href = "/";
            }}
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        className="project-mobile-trigger lg:hidden"
        onClick={() => onMobileOpenChange(true)}
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>
      {mobileOpen && <button type="button" className="project-sidebar__scrim lg:hidden" onClick={() => onMobileOpenChange(false)} aria-label="Close sidebar overlay" />}
      {aside}
    </>
  );
}
