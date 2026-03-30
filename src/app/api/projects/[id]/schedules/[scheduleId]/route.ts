import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET: Fetch a single schedule
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, scheduleId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
            shootDays: {
                orderBy: { dayNumber: "asc" },
                include: {
                    scenes: {
                        include: {
                            castLinks: { include: { castMember: true } },
                        },
                    },
                    location: true,
                },
            },
            blockedDates: { orderBy: { date: "asc" } },
        },
    });

    if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(schedule);
}

// PUT: Update schedule details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, scheduleId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = await req.json();

    const schedule = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
            name: data.name,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
    });

    return NextResponse.json(schedule);
}

// DELETE: Delete a schedule and cascading shoot days + blocked dates
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, scheduleId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.schedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ success: true });
}
