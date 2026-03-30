import { format, parseISO } from "date-fns";
import type {
  ScheduleBoardState,
  ScheduleProject,
  ScheduleScene,
  ScheduleShootDay,
  ScheduleUpdatePayload,
} from "@/components/schedule/types";

export function buildScheduleBoard(project: ScheduleProject): ScheduleBoardState {
  const board: ScheduleBoardState = {
    unscheduled: [...(project.scenes ?? [])],
  };

  for (const day of (project.shootDays ?? [])) {
    board[day.id] = [...day.scenes];
  }

  return board;
}

export function serializeScheduleBoard(
  board: ScheduleBoardState,
  days: ScheduleShootDay[]
): ScheduleUpdatePayload[] {
  const updates: ScheduleUpdatePayload[] = [];

  board.unscheduled?.forEach((scene, index) => {
    updates.push({
      id: scene.id,
      shootDayId: null,
      order: index,
    });
  });

  days.forEach((day) => {
    (board[day.id] ?? []).forEach((scene, index) => {
      updates.push({
        id: scene.id,
        shootDayId: day.id,
        order: index,
      });
    });
  });

  return updates;
}

export function hydrateProjectWithBoard(
  project: ScheduleProject,
  board: ScheduleBoardState
): ScheduleProject {
  return {
    ...project,
    scenes: (board.unscheduled ?? []).map((scene, order) => ({
      ...scene,
      shootDayId: null,
      status: "unscheduled",
      order,
    })),
    shootDays: project.shootDays.map((day) => ({
      ...day,
      scenes: (board[day.id] ?? []).map((scene, order) => ({
        ...scene,
        shootDayId: day.id,
        status: "scheduled",
        order,
      })),
    })),
  };
}

export function formatScheduleDate(date: string | null, fallback: string) {
  if (!date) return fallback;

  try {
    return format(parseISO(date), "EEE d MMM");
  } catch {
    return fallback;
  }
}

export function formatScheduleWeekday(date: string | null, fallback: string) {
  if (!date) return fallback;

  try {
    return format(parseISO(date), "EEEE");
  } catch {
    return fallback;
  }
}

export function getScenePages(scenes: ScheduleScene[]) {
  return scenes.reduce((sum, scene) => sum + (scene.pageCount || 0), 0);
}

export function getCastSummary(scene: ScheduleScene) {
  return scene.castLinks?.slice(0, 3).map((link) => link.castMember.name).join(" · ") || "No cast linked";
}

export function clampLoad(pageCount: number) {
  return Math.min(100, (pageCount / 4.5) * 100);
}

export function applySceneToDay(
  board: ScheduleBoardState,
  sceneId: string,
  dayId: string
): ScheduleBoardState {
  const next: ScheduleBoardState = {};
  let movedScene: ScheduleScene | undefined;

  Object.entries(board).forEach(([key, scenes]) => {
    const remaining = scenes.filter((scene) => {
      const matches = scene.id === sceneId;
      if (matches) {
        movedScene = scene;
      }
      return !matches;
    });
    next[key] = remaining;
  });

  if (!movedScene) {
    return board;
  }

  next[dayId] = [...(next[dayId] ?? []), { ...movedScene, shootDayId: dayId === "unscheduled" ? null : dayId }];
  return next;
}
