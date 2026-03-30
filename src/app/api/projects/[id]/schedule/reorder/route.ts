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

    try {
        // Validate all scene IDs belong to this project before updating
        const sceneIds = updates.map((u: SceneUpdate) => u.id);
        const existingScenes = await prisma.scene.findMany({
            where: { id: { in: sceneIds }, projectId: id },
            select: { id: true },
        });
        const validIds = new Set(existingScenes.map((s) => s.id));
        const invalidIds = sceneIds.filter((sid: string) => !validIds.has(sid));
        if (invalidIds.length > 0) {
            return NextResponse.json(
                { error: "Some scenes do not belong to this project", invalidIds },
                { status: 400 }
            );
        }

        // Scene.id is globally unique (cuid), so where: { id } is sufficient.
        // projectId is NOT part of a compound unique — using it in where would fail.
        const queries = updates.map((update: SceneUpdate) =>
            prisma.scene.update({
                where: { id: update.id },
                data: {
                    shootDayId: update.shootDayId,
                    order: update.order,
                    status: update.shootDayId ? "scheduled" : "unscheduled",
                },
            })
        );

        await prisma.$transaction(queries);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[schedule/reorder] Transaction failed:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Schedule reorder failed", detail: message },
            { status: 500 }
        );
    }
}
