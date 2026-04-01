"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { CallSheet } from "@/components/call-sheet/call-sheet";

export default function CallSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const { data: crew } = useQuery({
    queryKey: ["crew", id],
    queryFn: () => fetch(`/api/projects/${id}/crew`).then((r) => r.json()),
  });

  const { data: equipment } = useQuery({
    queryKey: ["equipment", id],
    queryFn: () => fetch(`/api/projects/${id}/equipment`).then((r) => r.json()),
  });

  if (loadingProject) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        Loading call sheet...
      </div>
    );
  }

  const days = (project?.shootDays || []).sort(
    (a: { dayNumber: number }, b: { dayNumber: number }) =>
      a.dayNumber - b.dayNumber
  );

  if (days.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "4rem" }}>
        <FileText size={48} strokeWidth={1.5} style={{ opacity: 0.4 }} />
        <p>No shoot days scheduled yet. Set up your schedule first.</p>
      </div>
    );
  }

  // Default to the first day that has scenes, or just the first day
  const effectiveDayId =
    selectedDayId ||
    days.find((d: { scenes: unknown[] }) => d.scenes?.length > 0)?.id ||
    days[0]?.id;

  const selectedDay = days.find(
    (d: { id: string }) => d.id === effectiveDayId
  ) || days[0];

  const currentIndex = days.findIndex(
    (d: { id: string }) => d.id === selectedDay.id
  );

  // Collect unique cast members from the selected day's scenes
  const castMap = new Map<string, { id: string; name: string; characterName: string | null; roleType: string }>();
  for (const scene of selectedDay.scenes || []) {
    for (const link of scene.castLinks || []) {
      const cm = link.castMember;
      if (cm && !castMap.has(cm.id)) {
        castMap.set(cm.id, {
          id: cm.id,
          name: cm.name,
          characterName: cm.characterName,
          roleType: cm.roleType,
        });
      }
    }
  }
  const dayCast = Array.from(castMap.values());

  // Show ALL project equipment on the call sheet (day-linked get specific quantity, others show default)
  const dayEquipment = (equipment || [])
    .map((eq: { id: string; name: string; category: string; quantityAvailable?: number; dayLinks?: { shootDay?: { id: string }; quantity?: number }[] }) => {
      const dayLink = eq.dayLinks?.find(
        (link: { shootDay?: { id: string } }) => link.shootDay?.id === selectedDay.id
      );
      return {
        id: eq.id,
        name: eq.name,
        category: eq.category,
        quantity: dayLink?.quantity || eq.quantityAvailable || 1,
      };
    });

  function formatDayLabel(day: { dayNumber: number; date: string | null }) {
    const dateStr = day.date
      ? new Date(day.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "TBD";
    return `Day ${day.dayNumber} \u2014 ${dateStr}`;
  }

  return (
    <div>
      <div className="call-sheet-toolbar">
        <select
          className="call-sheet-toolbar__day-select"
          value={selectedDay.id}
          onChange={(e) => setSelectedDayId(e.target.value)}
        >
          {days.map((d: { id: string; dayNumber: number; date: string | null }) => (
            <option key={d.id} value={d.id}>
              {formatDayLabel(d)}
            </option>
          ))}
        </select>

        <div className="call-sheet-toolbar__actions">
          <button
            onClick={() => window.print()}
            title="Print call sheet"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={() => {
              if (currentIndex > 0) setSelectedDayId(days[currentIndex - 1].id);
            }}
            disabled={currentIndex <= 0}
            title="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => {
              if (currentIndex < days.length - 1)
                setSelectedDayId(days[currentIndex + 1].id);
            }}
            disabled={currentIndex >= days.length - 1}
            title="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div>
        <CallSheet
          project={{
            id: project.id,
            title: project.title,
            genre: project.genre,
            format: project.format,
            currency: project.currency,
            defaultCallTime: project.defaultCallTime,
            defaultWrapTime: project.defaultWrapTime,
          }}
          day={selectedDay}
          castMembers={dayCast}
          crewMembers={crew || []}
          equipment={dayEquipment}
        />
      </div>
    </div>
  );
}
