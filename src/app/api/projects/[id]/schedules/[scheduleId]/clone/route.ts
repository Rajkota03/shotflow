import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/**
 * POST /api/projects/[id]/schedules/[scheduleId]/clone
 * Clones a schedule with all its shoot days and blocked dates.
 * Body: { name?: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, scheduleId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));

  const source = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      shootDays: { orderBy: { dayNumber: "asc" } },
      blockedDates: { orderBy: { date: "asc" } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Count existing schedules for naming
  const count = await prisma.schedule.count({ where: { projectId: id } });
  const cloneName = body.name || `${source.name} (v${count + 1})`;

  // Create cloned schedule
  const cloned = await prisma.schedule.create({
    data: {
      projectId: id,
      name: cloneName,
      startDate: source.startDate,
      endDate: source.endDate,
    },
  });

  // Clone shoot days
  if (source.shootDays.length > 0) {
    await prisma.shootDay.createMany({
      data: source.shootDays.map((d) => ({
        projectId: id,
        scheduleId: cloned.id,
        dayNumber: d.dayNumber,
        date: d.date,
        callTime: d.callTime,
        estimatedWrap: d.estimatedWrap,
        dayType: d.dayType,
        isTravelDay: d.isTravelDay,
        weatherContingency: d.weatherContingency,
        notes: d.notes,
        order: d.order,
        locationId: d.locationId,
      })),
    });
  }

  // Clone blocked dates
  if (source.blockedDates.length > 0) {
    await prisma.blockedDate.createMany({
      data: source.blockedDates.map((bd) => ({
        scheduleId: cloned.id,
        date: bd.date,
        reason: bd.reason,
      })),
    });
  }

  // Return full cloned schedule
  const full = await prisma.schedule.findUnique({
    where: { id: cloned.id },
    include: {
      shootDays: { orderBy: { dayNumber: "asc" }, include: { scenes: { select: { id: true } } } },
      blockedDates: { orderBy: { date: "asc" } },
    },
  });

  return NextResponse.json(full, { status: 201 });
}
