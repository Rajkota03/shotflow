import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeSchedule } from "@/lib/conflict-engine";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    // Fetch all scenes
    const scenes = await prisma.scene.findMany({ where: { projectId: id } });
    
    // Fetch all shoot days for the project
    const days = await prisma.shootDay.findMany({
        where: { projectId: id },
        orderBy: { dayNumber: 'asc' }
    });

    try {
        const report = analyzeSchedule(days, scenes);
        return NextResponse.json(report);
    } catch (error) {
        console.error("Conflict engine failed:", error);
        return NextResponse.json({ error: "Failed to run conflict engine" }, { status: 500 });
    }
}
