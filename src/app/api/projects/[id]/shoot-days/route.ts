import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logBudgetChange, calculateDayBudget } from "@/lib/budget-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const days = await prisma.shootDay.findMany({
    where: { projectId: id },
    orderBy: [{ dayNumber: "asc" }, { order: "asc" }],
    include: {
      location: true,
      scenes: {
        orderBy: { order: "asc" },
        include: {
          castLinks: { include: { castMember: true } },
          shots: true,
        },
      },
      equipmentLinks: { include: { equipment: true } },
    },
  });
  return NextResponse.json(days);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const maxDay = await prisma.shootDay.aggregate({
    where: { projectId: id },
    _max: { dayNumber: true, order: true },
  });

  const dayNumber = (maxDay._max.dayNumber ?? 0) + 1;

  const day = await prisma.shootDay.create({
    data: {
      projectId: id,
      dayNumber,
      date: body.date ? new Date(body.date) : null,
      callTime: body.callTime,
      estimatedWrap: body.estimatedWrap,
      dayType: body.dayType || "full",
      locationId: body.locationId || null,
      order: (maxDay._max.order ?? 0) + 1,
    },
    include: {
      location: true,
      scenes: true,
      equipmentLinks: { include: { equipment: true } },
    },
  });

  const budget = await calculateDayBudget(day.id);
  await logBudgetChange(id, "day_added", `Shoot Day ${dayNumber} added`, budget.total, "shoot_day", day.id);

  return NextResponse.json(day, { status: 201 });
}
