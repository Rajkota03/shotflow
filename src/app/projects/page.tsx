import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const latest = await prisma.project.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (latest) {
    redirect(`/projects/${latest.id}`);
  }

  redirect("/projects/new");
}
