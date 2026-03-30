import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { updates } = await req.json();

    if (!Array.isArray(updates)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    interface SceneUpdate { id: string; shootDayId: string | null; order: number; }

    // We perform the updates in a transaction for safety
    const queries = updates.map((update: SceneUpdate) =>
        prisma.scene.update({
            where: { id: update.id, projectId: id },
            data: {
                shootDayId: update.shootDayId,
                order: update.order,
                status: update.shootDayId ? "scheduled" : "unscheduled"
            }
        })
    );

    await prisma.$transaction(queries);

    // Note: Optimally we would log budget changes here if days changed,
    // but for a batch reorder we'll keep it simple.

    return NextResponse.json({ success: true });
}
