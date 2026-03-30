import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// POST: Block a date
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, scheduleId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { date, reason = "custom" } = await req.json();

    if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

    const dateObj = new Date(date);

    // Create blocked date
    const blocked = await prisma.blockedDate.create({
        data: { scheduleId, date: dateObj, reason },
    });

    // Remove any shoot day on that date
    const shootDay = await prisma.shootDay.findFirst({
        where: { scheduleId, date: dateObj },
    });

    if (shootDay) {
        // Unassign scenes from this shoot day first
        await prisma.scene.updateMany({
            where: { shootDayId: shootDay.id },
            data: { shootDayId: null, status: "unscheduled" },
        });
        await prisma.shootDay.delete({ where: { id: shootDay.id } });

        // Renumber remaining shoot days
        const allDays = await prisma.shootDay.findMany({
            where: { scheduleId },
            orderBy: { date: "asc" },
        });
        for (let i = 0; i < allDays.length; i++) {
            await prisma.shootDay.update({
                where: { id: allDays[i].id },
                data: { dayNumber: i + 1 },
            });
        }
    }

    return NextResponse.json(blocked, { status: 201 });
}

// DELETE: Unblock a date (and create a shoot day for it)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, scheduleId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { date } = await req.json();

    if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

    const dateObj = new Date(date);

    // Remove blocked date
    await prisma.blockedDate.deleteMany({
        where: { scheduleId, date: dateObj },
    });

    // Create a shoot day for this date
    const existingDays = await prisma.shootDay.findMany({
        where: { scheduleId },
        orderBy: { date: "asc" },
    });

    // Find the right position to insert
    let insertIndex = existingDays.length;
    for (let i = 0; i < existingDays.length; i++) {
        if (existingDays[i].date && existingDays[i].date! > dateObj) {
            insertIndex = i;
            break;
        }
    }

    await prisma.shootDay.create({
        data: {
            projectId: id,
            scheduleId,
            dayNumber: insertIndex + 1,
            date: dateObj,
        },
    });

    // Renumber all shoot days
    const allDays = await prisma.shootDay.findMany({
        where: { scheduleId },
        orderBy: { date: "asc" },
    });
    for (let i = 0; i < allDays.length; i++) {
        await prisma.shootDay.update({
            where: { id: allDays[i].id },
            data: { dayNumber: i + 1 },
        });
    }

    return NextResponse.json({ success: true });
}
