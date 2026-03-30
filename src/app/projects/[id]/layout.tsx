"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProjectHeader } from "@/components/layout/project-header";
import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { ToastProvider } from "@/components/ui/toast";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = use(params);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project-meta", id],
    queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()),
  });

  return (
    <ToastProvider>
      <div className="project-shell">
        <ProjectSidebar
          projectId={id}
          project={project}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />
        <div className="project-main">
          <ProjectHeader
            projectId={id}
            project={project}
            onOpenSidebar={() => setMobileNavOpen(true)}
          />
          <main className="project-content">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
