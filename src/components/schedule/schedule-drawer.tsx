"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Filter, Search, X } from "lucide-react";
import { SortableSceneStrip } from "@/components/schedule/scene-strip-card";
import { formatScheduleDate, formatScheduleWeekday, getScenePages } from "@/components/schedule/schedule-utils";
import type { ScheduleScene, ScheduleShootDay } from "@/components/schedule/types";
import { cn } from "@/lib/utils";

type IntExtFilter = "all" | "INT" | "EXT";
type DayNightFilter = "all" | "DAY" | "NIGHT";

interface ScheduleDrawerProps {
  open: boolean;
  day: ScheduleShootDay | null;
  scenes: ScheduleScene[];
  search: string;
  onSearchChange: (value: string) => void;
  intExtFilter: IntExtFilter;
  onIntExtFilterChange: (value: IntExtFilter) => void;
  dayNightFilter: DayNightFilter;
  onDayNightFilterChange: (value: DayNightFilter) => void;
  onClose: () => void;
  onQuickAdd: (sceneId: string) => void;
}

export function ScheduleDrawer({
  open,
  day,
  scenes,
  search,
  onSearchChange,
  intExtFilter,
  onIntExtFilterChange,
  dayNightFilter,
  onDayNightFilterChange,
  onClose,
  onQuickAdd,
}: ScheduleDrawerProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const matchesSearch = !search || `${scene.sceneNumber} ${scene.sceneName}`.toLowerCase().includes(search.toLowerCase());
      const matchesIE = intExtFilter === "all" || scene.intExt === intExtFilter;
      const matchesDN = dayNightFilter === "all" || scene.dayNight === dayNightFilter;
      return matchesSearch && matchesIE && matchesDN;
    });
  }, [dayNightFilter, intExtFilter, scenes, search]);

  const selectedPages = day ? getScenePages(day.scenes) : 0;

  return (
    <aside className={cn("schedule-drawer", open && "is-open")}>
      <div className="schedule-drawer__inner">
        {day ? (
          <>
            <div className="schedule-drawer__header">
              <div>
                <div className="schedule-drawer__eyebrow">Selected shoot day</div>
                <div className="schedule-drawer__title">{formatScheduleWeekday(day.date, `Day ${day.dayNumber}`)}</div>
                <div className="schedule-drawer__meta">
                  {formatScheduleDate(day.date, "Date TBD")} · {day.scenes.length} scheduled · {selectedPages.toFixed(1)} pp
                </div>
              </div>
              <button type="button" className="schedule-drawer__close" onClick={onClose} aria-label="Close strip drawer">
                <X size={16} />
              </button>
            </div>

            <div className="schedule-drawer__filters">
              <label className="schedule-drawer__search">
                <Search size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Find a scene or number"
                />
              </label>
              <div className="schedule-drawer__pill-row">
                {(["all", "INT", "EXT"] as IntExtFilter[]).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={cn("schedule-drawer__pill", intExtFilter === value && "is-active")}
                    onClick={() => onIntExtFilterChange(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="schedule-drawer__pill-row">
                {(["all", "DAY", "NIGHT"] as DayNightFilter[]).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={cn("schedule-drawer__pill", dayNightFilter === value && "is-active")}
                    onClick={() => onDayNightFilterChange(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="schedule-drawer__pool-label">
              <Filter size={13} />
              Scene pool for this date
            </div>

            <SortableContext items={filteredScenes.map((scene) => scene.id)} strategy={verticalListSortingStrategy}>
              <div ref={setNodeRef} className={cn("schedule-drawer__pool", isOver && "is-over")}>
                {filteredScenes.length === 0 ? (
                  <div className="schedule-drawer__empty">No matching scenes in the unscheduled pool.</div>
                ) : (
                  filteredScenes.map((scene) => (
                    <SortableSceneStrip
                      key={scene.id}
                      scene={scene}
                      trailingAction={{
                        label: `Add scene ${scene.sceneNumber} to day ${day.dayNumber}`,
                        onClick: () => onQuickAdd(scene.id),
                      }}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </>
        ) : (
          <div className="schedule-drawer__placeholder">
            <div className="schedule-drawer__placeholder-glow" />
            <div className="schedule-drawer__title">Scene strip drawer</div>
            <p className="schedule-drawer__meta">
              Select a date column to open the side stripboard, review scene options, and drop them directly into the schedule.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
