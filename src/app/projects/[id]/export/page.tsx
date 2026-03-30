"use client";

import React, { useState, use, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

type ExportFormat = "one-liner" | "stripboard" | "day-by-day" | "call-sheet";

interface ShootDay {
  id: string;
  dayNumber: number;
  date: string | null;
  scenes: {
    sceneNumber: string;
    sceneName: string;
    intExt: string;
    dayNight: string;
    pageCount: number;
    castLinks: { castMember: { name: string } }[];
  }[];
}

const FORMAT_OPTIONS: { key: ExportFormat; label: string }[] = [
  { key: "one-liner", label: "One-Liner" },
  { key: "stripboard", label: "Stripboard" },
  { key: "day-by-day", label: "Day-by-Day" },
  { key: "call-sheet", label: "Call Sheet" },
];

const FORMAT_LABELS: Record<ExportFormat, string> = {
  "one-liner": "One-Liner Schedule",
  stripboard: "Full Stripboard",
  "day-by-day": "Day-by-Day Schedule",
  "call-sheet": "Call Sheet",
};

export default function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [format, setFormat] = useState<ExportFormat>("one-liner");
  const [includePageCount, setIncludePageCount] = useState(true);
  const [includeCastList, setIncludeCastList] = useState(true);
  const [showDates, setShowDates] = useState(true);
  const [includeSceneText, setIncludeSceneText] = useState(false);
  const [colorCoding, setColorCoding] = useState(false);
  const [paperSize, setPaperSize] = useState<"A4" | "Letter">("A4");
  const [emailSending, setEmailSending] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  const handleDownload = useCallback(async () => {
    if (!project) return;
    const { exportOneLiner } = await import("@/lib/pdf-export");
    exportOneLiner(project);
  }, [project]);

  const handleSendEmail = useCallback(async () => {
    if (!project) return;
    setEmailSending(true);
    try {
      await fetch(`/api/projects/${id}/export/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          includePageCount,
          includeCastList,
          showDates,
          includeSceneText,
          colorCoding,
          paperSize,
        }),
      });
    } finally {
      setEmailSending(false);
    }
  }, [project, id, format, includePageCount, includeCastList, showDates, includeSceneText, colorCoding, paperSize]);

  const days: ShootDay[] = project?.shootDays || [];
  const totalScenes = days.reduce(
    (s: number, d: ShootDay) => s + d.scenes.length,
    0
  );

  const checkboxOptions = [
    { label: "Include page count", checked: includePageCount, onChange: setIncludePageCount },
    { label: "Include cast list", checked: includeCastList, onChange: setIncludeCastList },
    { label: "Show dates", checked: showDates, onChange: setShowDates },
    { label: "Include scene text", checked: includeSceneText, onChange: setIncludeSceneText },
    { label: "Color coding", checked: colorCoding, onChange: setColorCoding },
  ];

  const colCount =
    4 + (includeCastList ? 1 : 0) + (includePageCount ? 1 : 0);

  return (
    <div className="flex h-full">
      {/* ── Left Sidebar: Config (280px) ── */}
      <div
        className="w-[280px] flex-shrink-0 flex flex-col overflow-y-auto"
        style={{
          background: "var(--bg-surface-2)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex-1 p-5">
          {/* Format Selection */}
          <section className="mb-6">
            <label className="sf-label" style={{ marginBottom: 8, display: "block" }}>
              Format
            </label>
            <div className="sf-card" style={{ padding: "8px 12px" }}>
              {FORMAT_OPTIONS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-3 py-2 cursor-pointer"
                  style={{
                    fontSize: "var(--text-sm)",
                    color:
                      format === f.key
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                >
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === f.key}
                    onChange={() => setFormat(f.key)}
                    style={{ accentColor: "var(--blue-primary)" }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </section>

          {/* Options Checkboxes */}
          <section className="mb-6">
            <label className="sf-label" style={{ marginBottom: 8, display: "block" }}>
              Options
            </label>
            <div className="sf-card" style={{ padding: "8px 12px" }}>
              {checkboxOptions.map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-3 py-2 cursor-pointer"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.onChange(e.target.checked)}
                    style={{ accentColor: "var(--blue-primary)" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          {/* Paper Size */}
          <section className="mb-6">
            <label className="sf-label" style={{ marginBottom: 8, display: "block" }}>
              Paper Size
            </label>
            <select
              className="sf-select"
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as "A4" | "Letter")}
            >
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="Letter">Letter (8.5 x 11 in)</option>
            </select>
          </section>
        </div>

        {/* Bottom Actions */}
        <div
          className="p-5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            className="sf-btn sf-btn--primary w-full mb-2"
            onClick={handleDownload}
            disabled={!project}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: 6, flexShrink: 0 }}
            >
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
          <button
            className="sf-btn sf-btn--secondary w-full"
            onClick={handleSendEmail}
            disabled={!project || emailSending}
          >
            {emailSending ? "Sending..." : "Send to Email"}
          </button>
        </div>
      </div>

      {/* ── Right Panel: Live Preview ── */}
      <div
        className="flex-1 overflow-auto p-8 flex justify-center"
        style={{ background: "var(--bg-surface-2)" }}
      >
        {isLoading ? (
          <div
            className="flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
          >
            Loading preview...
          </div>
        ) : (
          <div
            className="sf-card w-full max-w-[700px] overflow-y-auto"
            style={{
              background: "#fff",
              color: "#111",
              minHeight: 900,
              padding: 32,
              borderRadius: "var(--radius-lg)",
              aspectRatio: paperSize === "A4" ? "210/297" : "8.5/11",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            {/* Preview Header */}
            <div
              style={{
                borderBottom: "2px solid #111",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "var(--font-ui)",
                  margin: 0,
                }}
              >
                {project?.title || "Untitled Project"}
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: "#666",
                  margin: "4px 0 0",
                }}
              >
                {FORMAT_LABELS[format]} &middot; {days.length} shoot day
                {days.length !== 1 ? "s" : ""} &middot; {totalScenes} scene
                {totalScenes !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Preview Table */}
            {days.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#999",
                  padding: "48px 0",
                  fontStyle: "italic",
                  fontSize: 13,
                }}
              >
                No shoot days scheduled yet.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  fontFamily: "var(--font-ui)",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: 10,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      SC#
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: 10,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      I/E
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: 10,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Location
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: 10,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      D/N
                    </th>
                    {includeCastList && (
                      <th
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          fontSize: 10,
                          color: "#666",
                          textTransform: "uppercase",
                        }}
                      >
                        Cast
                      </th>
                    )}
                    {includePageCount && (
                      <th
                        style={{
                          textAlign: "right",
                          padding: "4px 8px",
                          fontSize: 10,
                          color: "#666",
                          textTransform: "uppercase",
                        }}
                      >
                        PP
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {days.slice(0, 5).map((day) => (
                    <React.Fragment key={day.id}>
                      <tr>
                        <td
                          colSpan={colCount}
                          style={{
                            padding: "8px 8px 4px",
                            fontWeight: 700,
                            fontSize: 11,
                            color: colorCoding ? "#2563EB" : "#333",
                          }}
                        >
                          Day {day.dayNumber}
                          {showDates && day.date ? ` \u2014 ${new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}
                        </td>
                      </tr>
                      {day.scenes.map((s, si) => (
                        <tr
                          key={`${day.id}-${si}`}
                          style={{ borderBottom: "1px solid #eee" }}
                        >
                          <td
                            style={{
                              padding: "3px 8px",
                              fontFamily: "monospace",
                            }}
                          >
                            {s.sceneNumber}
                          </td>
                          <td style={{ padding: "3px 8px" }}>{s.intExt}</td>
                          <td style={{ padding: "3px 8px" }}>
                            {s.sceneName}
                            {includeSceneText && (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 9,
                                  color: "#999",
                                  marginTop: 2,
                                }}
                              >
                                Scene text preview
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "3px 8px" }}>{s.dayNight}</td>
                          {includeCastList && (
                            <td style={{ padding: "3px 8px", fontSize: 10 }}>
                              {s.castLinks
                                ?.map((c) => c.castMember.name)
                                .join(", ") || "\u2014"}
                            </td>
                          )}
                          {includePageCount && (
                            <td
                              style={{
                                padding: "3px 8px",
                                textAlign: "right",
                                fontFamily: "monospace",
                              }}
                            >
                              {s.pageCount}
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {days.length > 5 && (
                    <tr>
                      <td
                        colSpan={colCount}
                        style={{
                          padding: "12px 8px",
                          textAlign: "center",
                          color: "#999",
                          fontStyle: "italic",
                        }}
                      >
                        ... and {days.length - 5} more day
                        {days.length - 5 !== 1 ? "s" : ""}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
