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
    const { name, startDate, endDate, blockedWeekdays = [0] } = await req.json();
    // blockedWeekdays: array of day-of-week to block (0=Sunday, 6=Saturday)

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
        return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    // Create the schedule
    const schedule = await prisma.schedule.create({
        data: {
            projectId: id,
            name: name || "Main Schedule",
            startDate: start,
            endDate: end,
        },
    });

    // Generate shoot days and blocked dates
    const blockedDatesData: { scheduleId: string; date: Date; reason: string }[] = [];
    const shootDaysData: { projectId: string; scheduleId: string; dayNumber: number; date: Date }[] = [];
    let dayNumber = 1;

    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

        if (blockedWeekdays.includes(dayOfWeek)) {
            // Blocked day
            blockedDatesData.push({
                scheduleId: schedule.id,
                date: new Date(current),
                reason: dayOfWeek === 0 ? "sunday" : "blocked",
            });
        } else {
            // Shoot day
            shootDaysData.push({
                projectId: id,
                scheduleId: schedule.id,
                dayNumber: dayNumber++,
                date: new Date(current),
            });
        }

        current.setDate(current.getDate() + 1);
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
