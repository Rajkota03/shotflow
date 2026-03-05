"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useBudgetStore } from "@/store/budget-store";
import { BudgetSidebar } from "@/components/layout/budget-sidebar";
import { use } from "react";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = use(params);
  const pathname = usePathname();
  const refreshBudget = useBudgetStore(s => s.refreshBudget);
  const budget = useBudgetStore(s => s.budget);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()),
  });

  useEffect(() => {
    refreshBudget(id);
  }, [id, refreshBudget]);

  const navItems = [
    { label: "Schedule", href: `/projects/${id}/schedule`, icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { label: "Shot List", href: `/projects/${id}/shots`, icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" },
    { label: "Cast", href: `/projects/${id}/cast`, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "Locations", href: `/projects/${id}/locations`, icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
  ];

  async function handleExport(type: "one-liner" | "shots" | "budget") {
    setExportOpen(false);
    if (!project) return;

    if (type === "budget") {
      if (!budget) return;
      const { exportBudget } = await import("@/lib/pdf-export");
      exportBudget(project, budget);
      return;
    }

    // Need full project data with shots for one-liner and shot list
    const fullProject = await fetch(`/api/projects/${id}`).then(r => r.json());

    if (type === "one-liner") {
      const { exportOneLiner } = await import("@/lib/pdf-export");
      exportOneLiner(fullProject);
    } else if (type === "shots") {
      const { exportShotList } = await import("@/lib/pdf-export");
      exportShotList(fullProject);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Left Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-[#1a1a1a] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#f59e0b] rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-white">ShotFlow</span>
          </Link>
        </div>

        {/* Project Name */}
        {project && (
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Project</p>
            <p className="text-xs text-white font-medium truncate">{project.title}</p>
            <p className="text-[10px] text-[#555] capitalize">{project.format}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-[#1a1a1a] text-white" : "text-[#666] hover:text-[#ccc] hover:bg-[#111]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Export Menu */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setExportOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#555] hover:text-[#888] hover:bg-[#111] rounded-lg transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Export PDF
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden z-50 shadow-2xl">
                {[
                  { key: "one-liner" as const, label: "One-Liner Schedule", desc: "Scene list by shoot day" },
                  { key: "shots" as const, label: "Shot List", desc: "All shots by scene" },
                  { key: "budget" as const, label: "Budget Summary", desc: "Cost breakdown by dept/day" },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleExport(item.key)}
                    className="w-full px-3 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors border-b border-[#1a1a1a] last:border-0"
                  >
                    <p className="text-xs text-white font-medium">{item.label}</p>
                    <p className="text-[10px] text-[#555]">{item.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Back to Projects */}
        <div className="p-3 border-t border-[#1a1a1a]">
          <Link href="/projects" className="flex items-center gap-2 px-3 py-2 text-xs text-[#555] hover:text-[#888] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            All Projects
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </div>

      {/* Right Sidebar - Budget */}
      <BudgetSidebar projectId={id} currency={project?.currency || "INR"} />
    </div>
  );
}
