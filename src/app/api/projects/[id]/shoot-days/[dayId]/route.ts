import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logBudgetChange } from "@/lib/budget-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { dayId } = await params;
  const day = await prisma.shootDay.findUnique({
    where: { id: dayId },
    include: {
      location: true,
      scenes: {
        orderBy: { order: "asc" },
        include: { castLinks: { include: { castMember: true } }, shots: true },
      },
      equipmentLinks: { include: { equipment: true } },
    },
  });
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(day);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = await params;
  const body = await req.json();

  const prev = await prisma.shootDay.findUnique({ where: { id: dayId } });

  const day = await prisma.shootDay.update({
    where: { id: dayId },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      callTime: body.callTime,
      estimatedWrap: body.estimatedWrap,
      dayType: body.dayType,
      locationId: body.locationId !== undefined ? body.locationId : undefined,
      isTravelDay: body.isTravelDay,
      weatherContingency: body.weatherContingency,
      notes: body.notes,
      order: body.order !== undefined ? body.order : undefined,
    },
    include: {
      location: true,
      scenes: {
        orderBy: { order: "asc" },
        include: { castLinks: { include: { castMember: true } }, shots: true },
      },
      equipmentLinks: { include: { equipment: true } },
    },
  });

  // Log location change
  if (prev && body.locationId !== undefined && prev.locationId !== body.locationId) {
    const loc = body.locationId
      ? await prisma.location.findUnique({ where: { id: body.locationId } })
      : null;
    const prevLoc = prev.locationId
      ? await prisma.location.findUnique({ where: { id: prev.locationId } })
      : null;
    const delta = (loc ? loc.dailyRentalCost + loc.permitCost : 0) -
      (prevLoc ? prevLoc.dailyRentalCost + prevLoc.permitCost : 0);
    await logBudgetChange(
      id,
      "location_changed",
      `Day ${day.dayNumber} location changed to ${loc?.name ?? "none"}`,
      delta,
      "location",
      body.locationId
    );
  }

  return NextResponse.json(day);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = await params;
  const day = await prisma.shootDay.findUnique({ where: { id: dayId } });

  // Unschedule all scenes on this day
  await prisma.scene.updateMany({
    where: { shootDayId: dayId },
    data: { shootDayId: null, status: "unscheduled" },
  });

  await prisma.shootDay.delete({ where: { id: dayId } });

  if (day) {
    await logBudgetChange(id, "day_removed", `Shoot Day ${day.dayNumber} removed`, 0, "shoot_day", dayId);
  }

  return NextResponse.json({ success: true });
}
