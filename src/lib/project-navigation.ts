import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Boxes,
  CalendarRange,
  Camera,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Download,
  Film,
  FolderKanban,
  Gauge,
  History,
  Layers3,
  MapPin,
  Settings2,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export interface ProjectNavItem {
  segment: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

interface ProjectRouteMeta extends ProjectNavItem {
  match: string;
}

export const PROJECT_NAV_SECTIONS: Array<{
  label: string;
  items: ProjectNavItem[];
}> = [
  {
    label: "Pipeline",
    items: [
      {
        segment: "",
        label: "Dashboard",
        shortLabel: "Dashboard",
        description: "Project command center, health signals, and next actions.",
        icon: Gauge,
      },
      {
        segment: "script",
        label: "Script Intake",
        shortLabel: "Script",
        description: "Ingest the screenplay and extract production-ready scene structure.",
        icon: BookOpenText,
      },
      {
        segment: "breakdown",
        label: "Breakdown",
        shortLabel: "Breakdown",
        description: "Review scene elements and prepare departments for scheduling.",
        icon: Boxes,
      },
      {
        segment: "scenes",
        label: "Scene Library",
        shortLabel: "Scenes",
        description: "Search, score, and manage all parsed scenes in one place.",
        icon: Film,
      },
      {
        segment: "schedule",
        label: "Production Schedule",
        shortLabel: "Schedule",
        description: "Build and refine the shooting plan across days and locations.",
        icon: CalendarRange,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        segment: "budget",
        label: "Budget Planning",
        shortLabel: "Budget",
        description: "Track rate cards, day costs, and top-line spending.",
        icon: Wallet,
      },
      {
        segment: "cast",
        label: "Cast",
        shortLabel: "Cast",
        description: "Manage cast members, roles, and day rates.",
        icon: UserCheck,
      },
      {
        segment: "crew",
        label: "Crew",
        shortLabel: "Crew",
        description: "Coordinate key departments, staffing, and day allocations.",
        icon: Users,
      },
      {
        segment: "locations",
        label: "Locations",
        shortLabel: "Locations",
        description: "Track practicals, stages, and movement across the plan.",
        icon: MapPin,
      },
      {
        segment: "equipment",
        label: "Equipment",
        shortLabel: "Equipment",
        description: "Manage rental packages, availability, and day links.",
        icon: Wrench,
      },
      {
        segment: "shots",
        label: "Shot List",
        shortLabel: "Shots",
        description: "Plan camera setups, angles, and coverage per scene.",
        icon: Camera,
      },
      {
        segment: "history",
        label: "Change Log",
        shortLabel: "History",
        description: "Track budget modifications and schedule changes.",
        icon: History,
      },
      {
        segment: "reports",
        label: "Reports",
        shortLabel: "Reports",
        description: "Production reports, DOOD, call sheets, and custom report builder.",
        icon: ClipboardList,
      },
      {
        segment: "export",
        label: "Exports",
        shortLabel: "Export",
        description: "Generate one-liners, stripboards, and production packets.",
        icon: Download,
      },
      {
        segment: "settings",
        label: "Settings",
        shortLabel: "Settings",
        description: "Project configuration, permissions, and operating defaults.",
        icon: Settings2,
      },
    ],
  },
];

const PROJECT_ROUTE_META: ProjectRouteMeta[] = [
  {
    segment: "script/viewer",
    match: "/script/viewer",
    label: "Script Viewer",
    shortLabel: "Viewer",
    description: "Review the screenplay in context while validating parsed scenes.",
    icon: Clapperboard,
  },
  {
    segment: "schedule/setup",
    match: "/schedule/setup",
    label: "Schedule Setup",
    shortLabel: "Setup",
    description: "Define shoot dates, working days, and schedule constraints.",
    icon: Cog,
  },
  {
    segment: "call-sheet",
    match: "/call-sheet",
    label: "Call Sheet",
    shortLabel: "Call Sheet",
    description: "Generate daily call sheets for cast and crew.",
    icon: ClipboardCheck,
  },
  {
    segment: "schedules",
    match: "/schedules",
    label: "Schedule Versions",
    shortLabel: "Versions",
    description: "Compare and manage alternate scheduling passes.",
    icon: Layers3,
  },
  ...PROJECT_NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      match: item.segment ? `/${item.segment}` : "",
    }))
  ),
  {
    segment: "locations",
    match: "/locations",
    label: "Locations",
    shortLabel: "Locations",
    description: "Track practicals, stages, and movement across the plan.",
    icon: FolderKanban,
  },
];

export function getProjectRouteMeta(pathname: string): ProjectRouteMeta {
  const sorted = [...PROJECT_ROUTE_META].sort((a, b) => b.match.length - a.match.length);
  return sorted.find((item) => (item.match ? pathname.includes(item.match) : /\/projects\/[^/]+$/.test(pathname))) ??
    PROJECT_ROUTE_META.find((item) => item.segment === "")!;
}

export function getPrimaryPipelineItems(): ProjectNavItem[] {
  return PROJECT_NAV_SECTIONS[0].items.filter((item) => item.segment !== "");
}
