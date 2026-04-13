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
  castLinks: { castMember: { id?: string; name: string; characterName?: string | null; availableDates?: string | null; paymentMode?: "per_day" | "package"; dayRate?: number; packageFee?: number; roleType?: string } }[];
}

export interface ScheduleShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  callTime: string | null;
  estimatedWrap: string | null;
  dayType: string;
  location: { id?: string; name: string; dailyRentalCost?: number; permitCost?: number } | null;
  travelCost?: number;
  lodgingCost?: number;
  cateringCost?: number;
  scenes: ScheduleScene[];
  equipmentLinks?: { quantity: number; equipment: { id: string; name: string; dailyRental: number } }[];
}

export interface ScheduleCrewMember {
  id: string;
  name: string;
  department: string;
  role: string;
  paymentMode: "per_day" | "package";
  dayRate: number;
  packageFee: number;
}

export interface ScheduleCastMember {
  id: string;
  name: string;
  characterName: string | null;
  roleType: string;
  paymentMode: "per_day" | "package";
  dayRate: number;
  packageFee: number;
}

export interface ScheduleProject {
  id: string;
  title: string;
  currency: string;
  budgetCap: number;
  shootDays: ScheduleShootDay[];
  scenes: ScheduleScene[];
  crewMembers?: ScheduleCrewMember[];
  castMembers?: ScheduleCastMember[];
}

export type ScheduleBoardState = Record<string, ScheduleScene[]>;

export interface ScheduleUpdatePayload {
  id: string;
  shootDayId: string | null;
  order: number;
}
