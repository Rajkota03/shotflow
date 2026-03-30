"use client";

import { GripVertical, Plus } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { getCastSummary } from "@/components/schedule/schedule-utils";
import type { ScheduleScene } from "@/components/schedule/types";
import { cn } from "@/lib/utils";

interface SceneStripCardProps {
  scene: ScheduleScene;
  selected?: boolean;
  isDragging?: boolean;
  compact?: boolean;
  trailingAction?: {
    label: string;
    onClick: () => void;
  };
}

export function SceneStripCard({
  scene,
  selected = false,
  isDragging = false,
  compact = false,
  trailingAction,
}: SceneStripCardProps) {
  const toneClass = scene.dayNight === "NIGHT" ? "is-night" : scene.intExt === "EXT" ? "is-ext" : "is-int";

  return (
    <article
      className={cn(
        "schedule-strip",
        toneClass,
        selected && "is-selected",
        isDragging && "is-dragging",
        compact && "is-compact"
      )}
    >
      <div className="schedule-strip__top">
        <div className="schedule-strip__eyebrow">
          <span className="schedule-strip__code">Scene {scene.sceneNumber}</span>
          <span>{scene.intExt}</span>
          <span>{scene.dayNight}</span>
        </div>
        <div className="schedule-strip__page-count">{scene.pageCount.toFixed(1)} pp</div>
      </div>
      <div className="schedule-strip__title">{scene.sceneName}</div>
      <div className="schedule-strip__footer">
        <div className="schedule-strip__cast">{getCastSummary(scene)}</div>
        {trailingAction && (
          <button
            type="button"
            className="schedule-strip__quick-add"
            onClick={(event) => {
              event.stopPropagation();
              trailingAction.onClick();
            }}
            aria-label={trailingAction.label}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

interface SortableSceneStripProps {
  scene: ScheduleScene;
  selected?: boolean;
  compact?: boolean;
  trailingAction?: {
    label: string;
    onClick: () => void;
  };
}

export function SortableSceneStrip({
  scene,
  selected,
  compact,
  trailingAction,
}: SortableSceneStripProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("schedule-strip__sortable", isDragging && "is-sorting")}
      {...attributes}
      {...listeners}
    >
      <div className="schedule-strip__handle" aria-hidden="true">
        <GripVertical size={14} />
      </div>
      <SceneStripCard
        scene={scene}
        compact={compact}
        selected={selected}
        isDragging={isDragging}
        trailingAction={trailingAction}
      />
    </div>
  );
}
