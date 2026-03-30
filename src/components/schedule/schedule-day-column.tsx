"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { SortableSceneStrip } from "@/components/schedule/scene-strip-card";
import { clampLoad, formatScheduleDate, formatScheduleWeekday, getScenePages } from "@/components/schedule/schedule-utils";
import type { ScheduleScene, ScheduleShootDay } from "@/components/schedule/types";
import { cn } from "@/lib/utils";

interface ScheduleDayColumnProps {
  day: ScheduleShootDay;
  scenes: ScheduleScene[];
  selected: boolean;
  onSelect: () => void;
}

export function ScheduleDayColumn({ day, scenes, selected, onSelect }: ScheduleDayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const totalPages = getScenePages(scenes);

  return (
    <section
      ref={setNodeRef}
      className={cn("schedule-day-column", selected && "is-selected", isOver && "is-over")}
    >
      <button type="button" className="schedule-day-column__header" onClick={onSelect}>
        <div className="schedule-day-column__header-copy">
          <div className="schedule-day-column__dayline">
            <span className="schedule-day-column__day-label">{formatScheduleWeekday(day.date, `Day ${day.dayNumber}`)}</span>
            <span className="schedule-day-column__day-number">D{day.dayNumber}</span>
          </div>
          <div className="schedule-day-column__date">{formatScheduleDate(day.date, "Date TBD")}</div>
        </div>
        <div className="schedule-day-column__spark" />
      </button>

      <div className="schedule-day-column__meta">
        <span>
          <CalendarDays size={12} />
          {scenes.length} scenes
        </span>
        <span>
          <Clock3 size={12} />
          {day.callTime || "07:00"}
        </span>
        <span>
          <MapPin size={12} />
          {day.location?.name || "Floating"}
        </span>
      </div>

      <div className="schedule-day-column__loadbar">
        <span style={{ width: `${clampLoad(totalPages)}%` }} />
      </div>

      <div className="schedule-day-column__summary">
        <span>{totalPages.toFixed(1)} script pages</span>
        <span>{day.dayType.replace("_", " ")}</span>
      </div>

      <SortableContext items={scenes.map((scene) => scene.id)} strategy={verticalListSortingStrategy}>
        <div className="schedule-day-column__body">
          {scenes.length === 0 ? (
            <div className="schedule-day-column__empty">Drop scenes here</div>
          ) : (
            scenes.map((scene) => <SortableSceneStrip key={scene.id} scene={scene} selected={selected} compact />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}
