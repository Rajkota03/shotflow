import { prisma } from "./prisma";

export interface DayBudget {
  shootDayId: string;
  dayNumber: number;
  cast: number;
  location: number;
  equipment: number;
  crew: number;
  misc: number;
  total: number;
}

export interface ProjectBudget {
  totalProjected: number;
  budgetCap: number;
  variance: number;
  percentUsed: number;
  departments: DepartmentBudget[];
  days: DayBudget[];
  aboveTheLine: number;
  belowTheLine: number;
  postProduction: number;
  contingency: number;
}

export interface DepartmentBudget {
  name: string;
  amount: number;
  color: string;
}

export async function calculateDayBudget(shootDayId: string): Promise<DayBudget> {
  const day = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    include: {
      scenes: {
        include: {
          castLinks: {
            include: { castMember: true },
          },
        },
      },
      location: true,
      equipmentLinks: {
        include: { equipment: true },
      },
    },
  });

  if (!day) {
    return { shootDayId, dayNumber: 0, cast: 0, location: 0, equipment: 0, crew: 0, misc: 0, total: 0 };
  }

  // Calculate cast cost (unique cast members across all scenes on this day)
  const castRates = new Map<string, number>();
  for (const scene of day.scenes) {
    for (const link of scene.castLinks) {
      castRates.set(link.castMember.id, link.castMember.dayRate);
    }
  }
  const castCost = Array.from(castRates.values()).reduce((sum, rate) => sum + rate, 0);

  // Location cost
  const locationCost = day.location
    ? day.location.dailyRentalCost + day.location.permitCost
    : 0;

  // Equipment cost
  const equipmentCost = day.equipmentLinks.reduce(
    (sum, link) => sum + link.equipment.dailyRental * link.quantity,
    0
  );

  // Crew cost (base crew per day - simplified for MVP)
  const crewMembers = await prisma.crewMember.findMany({
    where: { projectId: day.projectId },
  });
  const crewCost = crewMembers.reduce((sum, crew) => sum + crew.dayRate, 0);

  // VFX shots misc cost
  const vfxShots = await prisma.shot.count({
    where: { scene: { shootDayId }, isVfx: true },
  });
  const miscCost = vfxShots * 50000; // Estimated VFX cost per shot

  const total = castCost + locationCost + equipmentCost + crewCost + miscCost;

  return {
    shootDayId,
    dayNumber: day.dayNumber,
    cast: castCost,
    location: locationCost,
    equipment: equipmentCost,
    crew: crewCost,
    misc: miscCost,
    total,
  };
}

export async function calculateProjectBudget(projectId: string): Promise<ProjectBudget> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      shootDays: {
        include: {
          scenes: {
            include: {
              castLinks: {
                include: { castMember: true },
              },
            },
          },
          location: true,
          equipmentLinks: {
            include: { equipment: true },
          },
        },
      },
      crewMembers: true,
    },
  });

  if (!project) {
    return {
      totalProjected: 0,
      budgetCap: 0,
      variance: 0,
      percentUsed: 0,
      departments: [],
      days: [],
      aboveTheLine: 0,
      belowTheLine: 0,
      postProduction: 0,
      contingency: 0,
    };
  }

  const days: DayBudget[] = [];
  let totalCast = 0;
  let totalLocation = 0;
  let totalEquipment = 0;
  let totalCrew = 0;
  let totalMisc = 0;

  const crewDailyTotal = project.crewMembers.reduce((sum, c) => sum + c.dayRate, 0);

  for (const day of project.shootDays) {
    const castRates = new Map<string, number>();
    for (const scene of day.scenes) {
      for (const link of scene.castLinks) {
        castRates.set(link.castMember.id, link.castMember.dayRate);
      }
    }
    const castCost = Array.from(castRates.values()).reduce((sum, r) => sum + r, 0);
    const locationCost = day.location
      ? day.location.dailyRentalCost + day.location.permitCost
      : 0;
    const equipmentCost = day.equipmentLinks.reduce(
      (sum, link) => sum + link.equipment.dailyRental * link.quantity,
      0
    );
    const crewCost = crewDailyTotal;

    // VFX shots misc cost per day
    const dayVfxShots = await prisma.shot.count({
      where: { scene: { shootDayId: day.id }, isVfx: true },
    });
    const miscCost = dayVfxShots * 50000;

    const total = castCost + locationCost + equipmentCost + crewCost + miscCost;

    days.push({
      shootDayId: day.id,
      dayNumber: day.dayNumber,
      cast: castCost,
      location: locationCost,
      equipment: equipmentCost,
      crew: crewCost,
      misc: miscCost,
      total,
    });

    totalCast += castCost;
    totalLocation += locationCost;
    totalEquipment += equipmentCost;
    totalCrew += crewCost;
    totalMisc += miscCost;
  }

  // VFX post production
  const vfxShots = await prisma.shot.count({
    where: { projectId, isVfx: true },
  });
  const postProduction = vfxShots * 50000;

  const subtotal = totalCast + totalLocation + totalEquipment + totalCrew + totalMisc + postProduction;
  const contingency = subtotal * 0.1;
  const totalProjected = subtotal + contingency;

  // Find lead cast for above-the-line
  const leadCast = await prisma.castMember.findMany({
    where: { projectId, roleType: { in: ["lead", "supporting"] } },
  });
  const aboveTheLine = leadCast.reduce((sum, c) => {
    // Estimate: lead cast days = shoot days count
    return sum + c.dayRate * project.shootDays.length;
  }, 0);

  const departments: DepartmentBudget[] = [
    { name: "Cast", amount: totalCast, color: "#3b82f6" },
    { name: "Locations", amount: totalLocation, color: "#10b981" },
    { name: "Equipment", amount: totalEquipment, color: "#f59e0b" },
    { name: "Crew", amount: totalCrew, color: "#8b5cf6" },
    { name: "Post/VFX", amount: postProduction, color: "#ec4899" },
    { name: "Contingency", amount: contingency, color: "#6b7280" },
  ].filter((d) => d.amount > 0);

  const budgetCap = project.budgetCap;
  const variance = budgetCap - totalProjected;
  const percentUsed = budgetCap > 0 ? (totalProjected / budgetCap) * 100 : 0;

  return {
    totalProjected,
    budgetCap,
    variance,
    percentUsed,
    departments,
    days,
    aboveTheLine,
    belowTheLine: totalCrew + totalEquipment + totalLocation,
    postProduction,
    contingency,
  };
}

export async function logBudgetChange(
  projectId: string,
  changeType: string,
  description: string,
  costDelta: number,
  entityType?: string,
  entityId?: string
) {
  await prisma.budgetChangeLog.create({
    data: {
      projectId,
      changeType,
      description,
      costDelta,
      entityType,
      entityId,
    },
  });
}
