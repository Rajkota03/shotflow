import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./utils";

const DARK_BG = [10, 10, 10] as [number, number, number];
const CARD_BG = [17, 17, 17] as [number, number, number];
const AMBER = [245, 158, 11] as [number, number, number];
const WHITE = [237, 237, 237] as [number, number, number];
const MUTED = [100, 100, 100] as [number, number, number];
const BORDER = [35, 35, 35] as [number, number, number];

function makeDoc(title: string, subtitle: string): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Background
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, 297, 210, "F");

  // Header bar
  doc.setFillColor(...CARD_BG);
  doc.rect(0, 0, 297, 18, "F");

  // Logo accent
  doc.setFillColor(...AMBER);
  doc.rect(8, 4, 6, 6, "F");

  // Title
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SHOTFLOW", 18, 8.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(title, 18, 13);

  // Right: subtitle + date
  doc.setFontSize(8);
  doc.text(subtitle, 289, 8.5, { align: "right" });
  doc.text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), 289, 13, { align: "right" });

  return doc;
}

// ─── One-Liner Schedule ────────────────────────────────────────────────────────
export function exportOneLiner(project: {
  title: string; currency: string;
  shootDays: {
    dayNumber: number; date: string | null; callTime: string | null; dayType: string;
    location: { name: string } | null;
    scenes: {
      sceneNumber: string; sceneName: string; intExt: string; dayNight: string;
      pageCount: number; status: string;
      castLinks: { castMember: { name: string } }[];
    }[];
  }[];
  scenes: {
    sceneNumber: string; sceneName: string; intExt: string; dayNight: string;
    pageCount: number; status: string;
    castLinks: { castMember: { name: string } }[];
  }[];
}) {
  const doc = makeDoc(project.title, "ONE-LINER SCHEDULE");

  const rows: (string | number)[][] = [];

  for (const day of project.shootDays) {
    const dateStr = day.date
      ? new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
      : "";

    for (const scene of day.scenes) {
      rows.push([
        `Day ${day.dayNumber}`,
        dateStr,
        day.location?.name ?? "—",
        scene.sceneNumber,
        `${scene.intExt}. ${scene.sceneName}`,
        scene.dayNight,
        scene.pageCount,
        scene.castLinks.map(l => l.castMember.name).join(", ") || "—",
        scene.status,
      ]);
    }
  }

  // Unscheduled
  for (const scene of project.scenes) {
    rows.push([
      "—",
      "—",
      "—",
      scene.sceneNumber,
      `${scene.intExt}. ${scene.sceneName}`,
      scene.dayNight,
      scene.pageCount,
      scene.castLinks.map(l => l.castMember.name).join(", ") || "—",
      "UNSCHEDULED",
    ]);
  }

  autoTable(doc, {
    startY: 22,
    head: [["Day", "Date", "Location", "Sc#", "Scene", "D/N", "Pgs", "Cast", "Status"]],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      fillColor: CARD_BG,
      textColor: WHITE,
      lineColor: BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [25, 25, 25],
      textColor: AMBER,
      fontSize: 7,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [13, 13, 13] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 10 },
      4: { cellWidth: 60 },
      5: { cellWidth: 12 },
      6: { cellWidth: 10 },
      7: { cellWidth: 60 },
      8: { cellWidth: 22 },
    },
  });

  doc.save(`${project.title.replace(/\s+/g, "_")}_one_liner.pdf`);
}

// ─── Shot List ─────────────────────────────────────────────────────────────────
export function exportShotList(project: {
  title: string;
  shootDays: { dayNumber: number; scenes: { sceneNumber: string; sceneName: string; intExt: string; dayNight: string; shots: { shotNumber: string; shotType: string; cameraMovement: string; lensMm: number | null; setupTimeMinutes: number; durationSeconds: number; description: string | null; isVfx: boolean }[] }[] }[];
  scenes: { sceneNumber: string; sceneName: string; intExt: string; dayNight: string; shots: { shotNumber: string; shotType: string; cameraMovement: string; lensMm: number | null; setupTimeMinutes: number; durationSeconds: number; description: string | null; isVfx: boolean }[] }[];
}) {
  const doc = makeDoc(project.title, "SHOT LIST");

  const allScenes = [
    ...project.shootDays.flatMap(d => d.scenes.map(s => ({ ...s, dayNumber: d.dayNumber }))),
    ...project.scenes.map(s => ({ ...s, dayNumber: null as number | null })),
  ];

  let currentY = 22;

  for (const scene of allScenes) {
    if (scene.shots.length === 0) continue;

    // Scene header
    if (currentY > 170) {
      doc.addPage();
      doc.setFillColor(...DARK_BG);
      doc.rect(0, 0, 297, 210, "F");
      currentY = 10;
    }

    doc.setFillColor(...CARD_BG);
    doc.rect(8, currentY, 281, 7, "F");
    doc.setFillColor(scene.intExt === "INT" ? 59 : 16, scene.intExt === "INT" ? 130 : 185, scene.intExt === "INT" ? 246 : 129);
    doc.rect(8, currentY, 2, 7, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${scene.intExt}. ${scene.sceneName}  (${scene.dayNight})${scene.dayNumber ? `  —  Day ${scene.dayNumber}` : "  —  UNSCHEDULED"}`,
      12, currentY + 4.5
    );
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`Scene ${scene.sceneNumber}  ·  ${scene.shots.length} shots  ·  ${scene.shots.reduce((s, sh) => s + sh.setupTimeMinutes, 0)}min setup`, 230, currentY + 4.5, { align: "right" });

    currentY += 7;

    const shotRows = scene.shots.map(sh => [
      sh.shotNumber,
      sh.shotType,
      sh.cameraMovement,
      sh.lensMm ? `${sh.lensMm}mm` : "—",
      `${sh.setupTimeMinutes}m`,
      `${sh.durationSeconds}s`,
      sh.isVfx ? "VFX" : "",
      sh.description || "—",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Shot#", "Type", "Movement", "Lens", "Setup", "Dur", "VFX", "Description"]],
      body: shotRows,
      margin: { left: 8, right: 8 },
      styles: { fontSize: 7, cellPadding: 1.8, fillColor: [13, 13, 13], textColor: WHITE, lineColor: BORDER, lineWidth: 0.1 },
      headStyles: { fillColor: [20, 20, 20], textColor: MUTED, fontSize: 6.5, fontStyle: "bold" },
      alternateRowStyles: { fillColor: CARD_BG },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 14 },
        4: { cellWidth: 14 },
        5: { cellWidth: 12 },
        6: { cellWidth: 10 },
        7: { cellWidth: 153 },
      },
      didDrawPage: () => {
        doc.setFillColor(...DARK_BG);
      },
    });

    currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  doc.save(`${project.title.replace(/\s+/g, "_")}_shot_list.pdf`);
}

// ─── Budget Summary ────────────────────────────────────────────────────────────
export function exportBudget(project: { title: string; currency: string; budgetCap: number }, budget: {
  totalProjected: number; budgetCap: number; variance: number; percentUsed: number;
  departments: { name: string; amount: number }[];
  days: { dayNumber: number; cast: number; location: number; equipment: number; crew: number; misc: number; total: number }[];
  aboveTheLine: number; belowTheLine: number; postProduction: number; contingency: number;
}) {
  const doc = makeDoc(project.title, "BUDGET SUMMARY");
  const cur = project.currency;

  // Summary cards row
  const cards = [
    { label: "TOTAL PROJECTED", value: formatCurrency(budget.totalProjected, cur), color: budget.percentUsed >= 100 ? "#ef4444" : budget.percentUsed >= 85 ? "#f59e0b" : "#10b981" },
    { label: "BUDGET CAP", value: formatCurrency(budget.budgetCap, cur), color: "#3b82f6" },
    { label: "VARIANCE", value: (budget.variance >= 0 ? "+" : "") + formatCurrency(Math.abs(budget.variance), cur), color: budget.variance >= 0 ? "#10b981" : "#ef4444" },
    { label: "% USED", value: `${budget.percentUsed.toFixed(1)}%`, color: budget.percentUsed >= 100 ? "#ef4444" : "#f59e0b" },
  ];

  let x = 8;
  for (const card of cards) {
    doc.setFillColor(...CARD_BG);
    doc.rect(x, 22, 65, 16, "F");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(card.label, x + 4, 27);
    const rgb = hexToRgb(card.color);
    doc.setTextColor(...rgb);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + 4, 34);
    x += 68;
  }

  // Department breakdown table
  autoTable(doc, {
    startY: 44,
    head: [["Department", "Amount", "% of Total"]],
    body: budget.departments.map(d => [
      d.name,
      formatCurrency(d.amount, cur),
      budget.totalProjected > 0 ? `${((d.amount / budget.totalProjected) * 100).toFixed(1)}%` : "0%",
    ]),
    margin: { left: 8, right: 8 },
    tableWidth: 130,
    styles: { fontSize: 8, cellPadding: 2.5, fillColor: CARD_BG, textColor: WHITE, lineColor: BORDER, lineWidth: 0.1 },
    headStyles: { fillColor: [25, 25, 25], textColor: AMBER, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [13, 13, 13] },
  });

  // Day-by-day cost table
  autoTable(doc, {
    startY: 44,
    head: [["Day", "Cast", "Location", "Equipment", "Crew", "Misc", "Total"]],
    body: budget.days.map(d => [
      `Day ${d.dayNumber}`,
      formatCurrency(d.cast, cur),
      formatCurrency(d.location, cur),
      formatCurrency(d.equipment, cur),
      formatCurrency(d.crew, cur),
      formatCurrency(d.misc, cur),
      formatCurrency(d.total, cur),
    ]),
    margin: { left: 148, right: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, fillColor: CARD_BG, textColor: WHITE, lineColor: BORDER, lineWidth: 0.1 },
    headStyles: { fillColor: [25, 25, 25], textColor: AMBER, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [13, 13, 13] },
    footStyles: { fillColor: [20, 20, 20], textColor: AMBER, fontStyle: "bold" },
    foot: [["TOTAL", "", "", "", "", "", formatCurrency(budget.totalProjected, cur)]],
  });

  doc.save(`${project.title.replace(/\s+/g, "_")}_budget.pdf`);
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
