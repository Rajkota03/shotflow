export interface ScheduleScene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  synopsis: string | null;
  status: string;
  shootDayId: string | null;
  castLinks: { castMember: { name: string; characterName?: string | null; availableDates?: string | null } }[];
}

export interface ScheduleShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  callTime: string | null;
  estimatedWrap: string | null;
  dayType: string;
  location: { name: string } | null;
  scenes: ScheduleScene[];
}

export interface ScheduleProject {
  id: string;
  title: string;
  currency: string;
  budgetCap: number;
  shootDays: ScheduleShootDay[];
  scenes: ScheduleScene[];
}

export type ScheduleBoardState = Record<string, ScheduleScene[]>;

export interface ScheduleUpdatePayload {
  id: string;
  shootDayId: string | null;
  order: number;
}
