import { cn } from "@/lib/utils";

interface ProjectStatItem {
  label: string;
  value: string;
  meta?: string;
}

interface ProjectPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  stats?: ProjectStatItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ProjectPageShell({
  eyebrow,
  title,
  description,
  stats,
  actions,
  children,
  className,
  contentClassName,
}: ProjectPageShellProps) {
  return (
    <section className={cn("project-page-shell", className)}>
      <div className="project-page-shell__hero">
        <div className="project-page-shell__copy">
          {eyebrow && <div className="project-page-shell__eyebrow">{eyebrow}</div>}
          <h2 className="project-page-shell__title">{title}</h2>
          {description && <p className="project-page-shell__description">{description}</p>}
        </div>
        {actions && <div className="project-page-shell__actions">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="project-page-shell__stats">
          {stats.map((stat) => (
            <div key={`${stat.label}-${stat.value}`} className="project-page-shell__stat">
              <span className="project-page-shell__stat-label">{stat.label}</span>
              <span className="project-page-shell__stat-value">{stat.value}</span>
              {stat.meta && <span className="project-page-shell__stat-meta">{stat.meta}</span>}
            </div>
          ))}
        </div>
      )}
      <div className={cn("project-page-shell__content", contentClassName)}>{children}</div>
    </section>
  );
}
