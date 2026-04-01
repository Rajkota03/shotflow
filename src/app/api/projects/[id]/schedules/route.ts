import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET: List all schedules for a project
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const schedules = await prisma.schedule.findMany({
        where: { projectId: id },
        include: {
            shootDays: {
                include: {
                    scenes: { select: { id: true } },
                },
                orderBy: { dayNumber: "asc" },
            },
            blockedDates: { orderBy: { date: "asc" } },
        },
        orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(schedules);
}

// POST: Create a new schedule (auto-generates shoot days, skipping Sundays)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { name, numberOfDays, startDate, endDate, blockedWeekdays = [0] } = await req.json();

    // Mode 1: Number of days (no dates yet — user assigns calendar later)
    // Mode 2: Date range (legacy — generates days from start/end)
    const useNumberMode = numberOfDays && numberOfDays > 0;

    if (!useNumberMode && (!startDate || !endDate)) {
        return NextResponse.json({ error: "Either numberOfDays or startDate+endDate required" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && end && end <= start) {
        return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    // Create the schedule
    const schedule = await prisma.schedule.create({
        data: {
            projectId: id,
            name: name || "Main Schedule",
            startDate: start ?? undefined,
            endDate: end ?? undefined,
        },
    });

    // Generate shoot days
    const blockedDatesData: { scheduleId: string; date: Date; reason: string }[] = [];
    const shootDaysData: { projectId: string; scheduleId: string; dayNumber: number; date?: Date }[] = [];

    if (useNumberMode) {
        // Create N days without dates
        for (let i = 1; i <= numberOfDays; i++) {
            shootDaysData.push({
                projectId: id,
                scheduleId: schedule.id,
                dayNumber: i,
                // no date assigned yet — user maps calendar later
            });
        }
    } else {
        // Date-range mode: generate days from start to end, skipping blocked weekdays
        let dayNumber = 1;
        const current = new Date(start!);
        while (current <= end!) {
            const dayOfWeek = current.getDay();
            if (blockedWeekdays.includes(dayOfWeek)) {
                blockedDatesData.push({
                    scheduleId: schedule.id,
                    date: new Date(current),
                    reason: dayOfWeek === 0 ? "sunday" : "blocked",
                });
            } else {
                shootDaysData.push({
                    projectId: id,
                    scheduleId: schedule.id,
                    dayNumber: dayNumber++,
                    date: new Date(current),
                });
            }
            current.setDate(current.getDate() + 1);
        }
    }

    // Bulk create
    if (blockedDatesData.length > 0) {
        await prisma.blockedDate.createMany({ data: blockedDatesData });
    }
    if (shootDaysData.length > 0) {
        await prisma.shootDay.createMany({ data: shootDaysData });
    }

    // Fetch and return the full schedule
    const fullSchedule = await prisma.schedule.findUnique({
        where: { id: schedule.id },
        include: {
            shootDays: { orderBy: { dayNumber: "asc" }, include: { scenes: { select: { id: true } } } },
            blockedDates: { orderBy: { date: "asc" } },
        },
    });

    return NextResponse.json(fullSchedule, { status: 201 });
}
