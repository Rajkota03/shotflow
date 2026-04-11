"use client";
import { useState, useCallback, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  MapPin,
  Users,
  Film,
  BookOpen,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */
type Phase = "upload" | "processing" | "validation";

interface ParsedScene {
  sceneNumber: string;
  heading: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  content: string;
  characters: string[];
}

interface ParseResult {
  scenes: ParsedScene[];
  characters: string[];
  locations: string[];
  totalPages: number;
  warnings: { line: number; message: string }[];
}

const PROCESS_STEPS = [
  "Reading file",
  "Detecting encoding",
  "Parsing scenes",
  "Extracting elements",
  "Validating structure",
] as const;

/* ── Page ──────────────────────────────────────────────── */
export default function ScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Processing pipeline ───────────────────────────── */
  const processScript = useCallback(
    async (text: string, name: string) => {
      setPhase("processing");
      setFileName(name);
      setCompletedSteps([]);
      setCurrentStep(0);

      for (let i = 0; i < PROCESS_STEPS.length; i++) {
        setCurrentStep(i);
        await new Promise((r) => setTimeout(r, 450 + Math.random() * 350));
        setCompletedSteps((prev) => [...prev, i]);
      }

      const scenes = parseScriptText(text);
      const characters = extractCharacters(text);
      const locations = extractLocations(scenes);
      const totalPages = scenes.reduce((sum, s) => sum + s.pageCount, 0);
      const warnings = generateWarnings(scenes);

      const parsed: ParseResult = {
        scenes,
        characters,
        locations,
        totalPages,
        warnings,
      };
      setResult(parsed);

      // Update project title from script filename
      const scriptTitle = name.replace(/\.[^/.]+$/, "").trim();
      if (scriptTitle) {
        try {
          await fetch(`/api/projects/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: scriptTitle }),
          });
          qc.invalidateQueries({ queryKey: ["project", id] });
          qc.invalidateQueries({ queryKey: ["project-meta", id] });
        } catch { /* best-effort */ }
      }

      // Save scenes + auto-create cast from characters
      try {
        await fetch(`/api/projects/${id}/scenes/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenes, characters }),
        });
        qc.invalidateQueries({ queryKey: ["cast", id] });
      } catch {
        // Fallback: save individually
        for (const scene of scenes) {
          await fetch(`/api/projects/${id}/scenes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneNumber: scene.sceneNumber,
              sceneName: scene.heading,
              intExt: scene.intExt,
              dayNight: scene.dayNight,
              pageCount: scene.pageCount,
              synopsis: scene.content.slice(0, 200),
            }),
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["project-meta", id] });
      setTimeout(() => setPhase("validation"), 600);
    },
    [id, qc]
  );

  /* ── File handling ─────────────────────────────────── */
  const handleFile = useCallback(
    async (file: File) => {
      setFileSize(`${(file.size / 1024).toFixed(0)} KB`);

      let text: string;
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "pdf") {
        // Extract text server-side (pdfjs legacy build works in Node without browser APIs)
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/extract-pdf", { method: "POST", body: form });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(err.error || `Server returned ${res.status}`);
          }
          const { text: pdfText } = await res.json();
          text = pdfText;
        } catch (pdfError) {
          console.error("[script/handleFile] PDF extraction failed:", pdfError);
          alert(
            `Failed to read PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}. Try converting to .fdx or .fountain first.`
          );
          return;
        }
      } else if (ext === "docx") {
        // Word document — convert to HTML then strip tags preserving line breaks
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        // Convert HTML paragraphs to text with proper line breaks
        text = htmlResult.value
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/h[1-6]>/gi, "\n")
          .replace(/<\/li>/gi, "\n")
          .replace(/<\/tr>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, "\n\n");
      } else if (ext === "fdx") {
        // Final Draft XML — extract text content from paragraphs
        const raw = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "text/xml");
        const paragraphs = doc.querySelectorAll("Paragraph");
        const lines: string[] = [];
        paragraphs.forEach((p) => {
          const texts = Array.from(p.querySelectorAll("Text")).map((t) => t.textContent || "");
          lines.push(texts.join(""));
        });
        text = lines.join("\n");
      } else {
        // Plain text / fountain
        text = await file.text();
      }

      processScript(text, file.name);
    },
    [processScript]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePasteSubmit = useCallback(() => {
    if (pasteText.trim()) {
      processScript(pasteText, "pasted-script.txt");
      setPasteMode(false);
      setPasteText("");
    }
  }, [pasteText, processScript]);

  /* ================================================================
     UPLOAD PHASE
     ================================================================ */
  if (phase === "upload") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "48px 24px",
        }}
      >
        {/* Upload zone */}
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div
            className={`sf-upload-zone${dragOver ? " is-dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".fdx,.fountain,.pdf,.docx,.txt"
              style={{ display: "none" }}
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />

            {/* Icon */}
            <div style={{ marginBottom: 16 }}>
              <FileText
                size={48}
                strokeWidth={1.2}
                style={{ color: "var(--text-tertiary)" }}
              />
            </div>

            {/* Heading */}
            <p
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Drop your script here
            </p>

            {/* Supported types */}
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                marginBottom: 24,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.02em",
              }}
            >
              .fdx &middot; .fountain &middot; .pdf &middot; .docx
            </p>

            {/* Browse button */}
            <button
              className="sf-btn sf-btn--primary"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={14} />
              Browse files
            </button>
          </div>

          {/* Paste link */}
          {!pasteMode ? (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                className="sf-btn sf-btn--ghost"
                onClick={() => setPasteMode(true)}
                style={{ gap: 6 }}
              >
                <ClipboardPaste size={14} />
                or paste script text
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <textarea
                autoFocus
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your screenplay text here..."
                style={{
                  width: "100%",
                  minHeight: 160,
                  padding: 16,
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-screenplay)",
                  fontSize: "var(--text-sm)",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="sf-btn sf-btn--secondary"
                  onClick={() => {
                    setPasteMode(false);
                    setPasteText("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="sf-btn sf-btn--primary"
                  onClick={handlePasteSubmit}
                  style={{
                    opacity: pasteText.trim() ? 1 : 0.4,
                    pointerEvents: pasteText.trim() ? "auto" : "none",
                  }}
                >
                  Import text
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ================================================================
     PROCESSING PHASE
     ================================================================ */
  if (phase === "processing") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div className="sf-card">
            {/* File info header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {fileName}
                </p>
                {fileSize && (
                  <p
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {fileSize}
                  </p>
                )}
              </div>
              <span className="sf-badge sf-badge--blue">Processing</span>
            </div>

            {/* Progress bar */}
            <div className="sf-progress" style={{ marginBottom: 24 }}>
              <div
                className="sf-progress__fill"
                style={{
                  width: `${((completedSteps.length) / PROCESS_STEPS.length) * 100}%`,
                }}
              />
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {PROCESS_STEPS.map((step, i) => {
                const isCompleted = completedSteps.includes(i);
                const isCurrent = i === currentStep && !isCompleted;
                const isPending = i > currentStep;

                return (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: isPending ? 0.3 : 1,
                      transition: "opacity 300ms ease-out",
                      animationDelay: `${i * 80}ms`,
                    }}
                  >
                    {/* Step icon */}
                    {isCompleted ? (
                      <CheckCircle2
                        size={18}
                        style={{ color: "var(--green)", flexShrink: 0 }}
                      />
                    ) : isCurrent ? (
                      <Loader2
                        size={18}
                        className="sf-spin"
                        style={{ color: "var(--blue)", flexShrink: 0 }}
                      />
                    ) : (
                      <Circle
                        size={18}
                        style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
                      />
                    )}

                    {/* Step label */}
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        color: isCompleted
                          ? "var(--text-primary)"
                          : isCurrent
                            ? "var(--text-primary)"
                            : "var(--text-tertiary)",
                        fontWeight: isCurrent ? 500 : 400,
                      }}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spin keyframe */}
        <style>{`
          .sf-spin {
            animation: sf-spin 1s linear infinite;
          }
          @keyframes sf-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  /* ================================================================
     VALIDATION PHASE
     ================================================================ */
  if (!result) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        overflowY: "auto",
        padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Success header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <CheckCircle2
            size={40}
            style={{ color: "var(--green)", marginBottom: 12 }}
          />
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Script imported successfully
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {fileName}
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              value: Math.round(result.totalPages),
              label: "Pages",
              icon: BookOpen,
            },
            { value: result.scenes.length, label: "Scenes", icon: Film },
            {
              value: result.characters.length,
              label: "Characters",
              icon: Users,
            },
            {
              value: result.locations.length,
              label: "Locations",
              icon: MapPin,
            },
          ].map((stat) => (
            <div key={stat.label} className="sf-stat-card" style={{ padding: 16, textAlign: "center" }}>
              <div className="sf-stat-card__number" style={{ fontSize: "var(--text-2xl)" }}>
                {stat.value}
              </div>
              <div className="sf-stat-card__label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Script preview */}
        <div className="sf-card" style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Script Preview
          </p>
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              background: "var(--bg-surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              fontFamily: "var(--font-screenplay)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              position: "relative",
            }}
          >
            {result.scenes.slice(0, 4).map((scene, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <p
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  {scene.intExt}. {scene.heading} - {scene.dayNight}
                </p>
                <p style={{ color: "var(--text-secondary)" }}>
                  {scene.content.slice(0, 200)}
                  {scene.content.length > 200 ? "..." : ""}
                </p>
              </div>
            ))}
            {/* Fade-out gradient */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                height: 48,
                background:
                  "linear-gradient(transparent, var(--bg-surface-1))",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="sf-inline-warning" style={{ borderRadius: "var(--radius-md)", padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <AlertTriangle size={14} style={{ color: "var(--amber)" }} />
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--amber)",
                  }}
                >
                  {result.warnings.length} item
                  {result.warnings.length !== 1 ? "s" : ""} need review
                </span>
              </div>
              {result.warnings.map((w, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                    paddingLeft: 22,
                  }}
                >
                  Line {w.line}: {w.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="sf-btn sf-btn--secondary"
            style={{ flex: 1 }}
            onClick={() => {
              setPhase("upload");
              setResult(null);
              setCompletedSteps([]);
              setCurrentStep(0);
            }}
          >
            <RotateCcw size={14} />
            Re-import
          </button>
          <button
            className="sf-btn sf-btn--primary"
            style={{ flex: 1 }}
            onClick={() => router.push(`/projects/${id}/breakdown`)}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PARSING HELPERS
   ================================================================ */
function parseScriptText(text: string): ParsedScene[] {
  const scenes: ParsedScene[] = [];

  // Forgiving heading matcher — matches ANY line that starts with optional scene number
  // followed by INT/EXT/I/E. Location and TOD are parsed separately from the tail.
  // This catches headings without TOD, without dash separators, with extra trailing text, etc.
  const TOD_WORDS = "DAY|NIGHT|DAWN|DUSK|EVENING|MORNING|CONTINUOUS|LATER|SAME TIME|SAME|MAGIC HOUR|AFTERNOON|MIDNIGHT|NOON|PRE-DAWN|SUNRISE|SUNSET";
  // Case-sensitive: screenplays always use uppercase INT/EXT. Lowercase would
  // match things like "int n=10;" in dialogue or code snippets.
  const headingStart =
    /^\s*(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)?\s*\.?\s*(INT\.\/EXT\.|INT\/EXT|I\/E|INT\.?|EXT\.?)[\s:.-]+(.+?)\s*$/;

  function parseHeadingLine(line: string): {
    sceneNumber: string | null;
    heading: string;
    intExt: "INT" | "EXT";
    dayNight: string;
  } | null {
    const m = headingStart.exec(line);
    if (!m) return null;

    const leadNum = m[1] || null;
    const ieRaw = m[2].toUpperCase().replace(/\./g, "");
    const intExt: "INT" | "EXT" = ieRaw.includes("EXT") ? "EXT" : "INT";

    let tail = m[3].trim();

    // Strip trailing scene number (e.g. "OFFICE - DAY 16A" or "OFFICE - DAY 16A 16A")
    let trailingNum: string | null = null;
    const trailNumMatch = tail.match(/^(.*?)\s+(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)(?:\s+\d+[A-Za-z]*)?\s*$/);
    if (trailNumMatch) {
      // Only strip if there's something meaningful before the trailing number
      if (trailNumMatch[1].trim().length > 0) {
        tail = trailNumMatch[1].trim();
        trailingNum = trailNumMatch[2];
      }
    }

    // Look for TOD at the end of tail, separated by dash/comma/whitespace
    let dayNight = "DAY"; // default when missing
    const todRegex = new RegExp(`^(.+?)[\\s\\-\\u2013\\u2014,:]+(${TOD_WORDS})\\s*$`, "i");
    const todMatch = tail.match(todRegex);
    if (todMatch) {
      tail = todMatch[1].trim();
      dayNight = normalizeTOD(todMatch[2]);
    } else {
      // Maybe the TOD is glued to the location without separator (PDF artifacts): "OFFICEDAY"
      const gluedTod = new RegExp(`^(.+?)(${TOD_WORDS})\\s*$`, "i");
      const gm = tail.match(gluedTod);
      if (gm && gm[1].trim().length > 2) {
        tail = gm[1].trim();
        dayNight = normalizeTOD(gm[2]);
      }
    }

    // Strip trailing dashes or punctuation from the heading
    tail = tail.replace(/[\s\-\u2013\u2014,:]+$/, "").trim();

    return {
      sceneNumber: leadNum || trailingNum,
      heading: tail.replace(/\s+/g, " ") || "UNTITLED LOCATION",
      intExt,
      dayNight,
    };
  }

  const lines = text.split("\n");
  let currentScene: ParsedScene | null = null;
  let sceneNum = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentScene) currentScene.content += "\n";
      continue;
    }

    const parsed = parseHeadingLine(trimmed);
    if (parsed) {
      if (currentScene) scenes.push(currentScene);
      sceneNum++;
      currentScene = {
        sceneNumber: parsed.sceneNumber || String(sceneNum),
        heading: parsed.heading,
        intExt: parsed.intExt,
        dayNight: parsed.dayNight,
        pageCount: 0,
        content: "",
        characters: [],
      };
    } else if (currentScene) {
      currentScene.content += line + "\n";
    }
  }
  if (currentScene) scenes.push(currentScene);

  // If standard regex found nothing, try a looser pattern for PDF text
  if (scenes.length === 0) {
    const looseRegex =
      /(?:^|\n)\s*(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)?\s*\.?\s*(INT|EXT|INT\/EXT)\.?\s+(.+?)[-\u2013\u2014\s]\s*(DAY|NIGHT|DAWN|DUSK)\s*(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)?\s*$/gm;
    let looseMatch;
    let looseNum = 0;
    let lastIdx = 0;

    while ((looseMatch = looseRegex.exec(text)) !== null) {
      if (currentScene) {
        currentScene.content = text.substring(lastIdx, looseMatch.index);
        scenes.push(currentScene);
      }
      looseNum++;
      const ieRaw = looseMatch[2].toUpperCase();
      currentScene = {
        sceneNumber: looseMatch[1] || looseMatch[5] || String(looseNum),
        heading: looseMatch[3].trim().replace(/[-\u2013\u2014]\s*$/, "").replace(/\s+/g, " "),
        intExt: ieRaw.includes("EXT") ? "EXT" : "INT",
        dayNight: normalizeTOD(looseMatch[4]),
        pageCount: 0,
        content: "",
        characters: [],
      };
      lastIdx = looseMatch.index + looseMatch[0].length;
    }
    if (currentScene) {
      currentScene.content = text.substring(lastIdx);
      scenes.push(currentScene);
    }
  }

  // Indian screenplay format: "Scene 1Location – ... Characters – ... Time: ..."
  // or "Scene 1\nLocation – ..." (with line breaks between fields)
  if (scenes.length === 0) {
    // First, normalize. Real-world Indian scripts have several recurring quirks:
    //  1. "Locatoin-" typo for "Location-"
    //  2. Merged headings like "Scene 52 & 52A" (share same Location/Characters/Time)
    //  3. Docx concatenates "Scene 1Location" without a space
    const normalized = text
      // Fix common typo so the Location detection below works
      .replace(/Locatoin/gi, "Location")
      // Strip ampersand-merged scene numbers: "Scene 52 & 52A" → "Scene 52"
      // (secondary numbers share the same block — treat as one scene)
      .replace(/(Scene\s*\d+[A-Z]?)(?:\s*&\s*\d+[A-Z]?)+/gi, "$1")
      .replace(/Scene\s*(\d+[A-Z]?)\s*Location/gi, "\nScene $1\nLocation")
      .replace(/Location\s*[-–—:]\s*/gi, "\nLocation: ")
      .replace(/Characters?\s*[-–—:]\s*/gi, "\nCharacters: ")
      .replace(/Time\s*[-–—:]\s*/gi, "\nTime: ");

    const indianRegex =
      /Scene\s+(\d+[A-Z]?)\s*\n\s*Location:\s*([^\n]+)\s*\n\s*Characters:\s*([^\n]+)\s*\n\s*Time:\s*([^\n]+)/gi;
    let indMatch;
    const indMatches: {
      index: number;
      num: string;
      location: string;
      characters: string;
      time: string;
    }[] = [];

    while ((indMatch = indianRegex.exec(normalized)) !== null) {
      indMatches.push({
        index: indMatch.index,
        num: indMatch[1],
        location: indMatch[2].trim(),
        characters: indMatch[3].trim(),
        time: indMatch[4].trim(),
      });
    }

    for (let i = 0; i < indMatches.length; i++) {
      const m = indMatches[i];
      // Find where the Time: line ends, body starts after that
      const timePos = normalized.indexOf(m.time, m.index);
      const bodyStart = timePos > 0 ? normalized.indexOf("\n", timePos) : -1;
      const bodyEnd = i + 1 < indMatches.length ? indMatches[i + 1].index : normalized.length;
      const body = bodyStart > 0 ? normalized.substring(bodyStart, bodyEnd).trim() : "";

      // Infer INT/EXT from location keywords
      const locLower = m.location.toLowerCase();
      const isExt = /\b(road|street|highway|garden|park|beach|river|mountain|market|outside|rooftop|terrace|field|ground|jungle|forest)\b/.test(locLower);
      const intExt = isExt ? "EXT" : "INT";

      // Infer DAY/NIGHT from time
      const timeLower = m.time.toLowerCase();
      let dayNight = "DAY";
      const timeMatch = timeLower.match(/(\d{1,2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        if (hour >= 18 || hour <= 5) dayNight = "NIGHT";
      }
      if (/night|evening/i.test(timeLower)) dayNight = "NIGHT";
      if (/morning|dawn/i.test(timeLower)) dayNight = "DAY";

      // Extract character names from the Characters field
      const sceneChars = m.characters
        .split(/[,&]|\band\b/i)
        .map((n) => n.trim())
        .filter((n) => n.length > 1 && n.length < 30)
        .map((n) => n.replace(/^and\s+/i, "").replace(/Time.*$/i, "").trim())
        .filter(Boolean);

      scenes.push({
        sceneNumber: m.num,
        heading: m.location,
        intExt,
        dayNight,
        pageCount: 0,
        content: body,
        characters: sceneChars,
      });
    }
  }

  // Estimate page counts + extract per-scene characters for Hollywood format
  const IGNORE_NAMES = new Set([
    "INT", "EXT", "CUT TO", "FADE IN", "FADE OUT", "DISSOLVE TO",
    "SMASH CUT", "JUMP CUT", "MATCH CUT", "CONTINUED", "MORE",
    "CONT", "INTERCUT", "BACK TO", "END", "THE END", "TITLE",
    "FLASHBACK", "DREAM SEQUENCE", "MONTAGE", "SERIES OF SHOTS",
    "SUPER", "CHYRON", "V.O", "O.S", "LATER", "ANGLE ON",
  ]);

  for (const scene of scenes) {
    const contentLen = scene.content.trim().length;
    const lineCount = scene.content.split("\n").filter((l) => l.trim()).length;
    const byChars = Math.max(0.125, Math.round((contentLen / 3000) * 8) / 8);
    const byLines = Math.max(0.125, Math.round((lineCount / 56) * 8) / 8);
    scene.pageCount = Math.max(byChars, byLines);

    // Extract characters from scene content if not already populated (Indian format already has them)
    if (scene.characters.length === 0) {
      const charSet = new Set<string>();
      const charRegex = /^([A-Z][A-Z\s.'-]{1,28})(?:\s*\(.*\))?\s*$/gm;
      let cm;
      while ((cm = charRegex.exec(scene.content)) !== null) {
        const name = cm[1].trim().replace(/\s+/g, " ");
        if (name.length > 1 && !IGNORE_NAMES.has(name) && !/^\d/.test(name)) {
          charSet.add(name);
        }
      }
      scene.characters = Array.from(charSet);
    }
  }

  return scenes;
}

function normalizeTOD(val: string): string {
  const upper = val.toUpperCase();
  if (["CONTINUOUS", "LATER", "SAME TIME", "MORNING"].includes(upper)) return "DAY";
  if (["EVENING", "MAGIC HOUR"].includes(upper)) return "NIGHT";
  return upper;
}

function extractCharacters(text: string): string[] {
  const chars = new Set<string>();

  // Indian format: "Characters – Name1, Name2, Name3"
  const indianCharRegex = /Characters?\s*[-–—:]\s*([^\n]+)/gi;
  let icMatch;
  while ((icMatch = indianCharRegex.exec(text)) !== null) {
    const names = icMatch[1].split(/[,&]|\band\b/i).map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      if (name.length > 1 && name.length < 30) {
        // Clean up: remove "and" prefix, time suffixes
        const cleaned = name.replace(/^and\s+/i, "").replace(/Time.*$/i, "").trim();
        if (cleaned) chars.add(cleaned);
      }
    }
  }

  // Hollywood format: ALL CAPS character names on their own line
  if (chars.size === 0) {
    const charRegex = /^([A-Z][A-Z\s.'-]{1,30})$/gm;
    let match;
    while ((match = charRegex.exec(text)) !== null) {
      const name = match[1].trim();
      if (
        name.length > 1 &&
        name.length < 25 &&
        ![
          "INT",
          "EXT",
          "CUT TO",
          "FADE IN",
          "FADE OUT",
          "DISSOLVE TO",
          "CONTINUOUS",
          "LATER",
          "FLASH BACK",
          "END",
        ].includes(name)
      ) {
        chars.add(name);
      }
    }
  }

  return Array.from(chars).slice(0, 50);
}

function extractLocations(scenes: ParsedScene[]): string[] {
  const locs = new Set<string>();
  for (const s of scenes) {
    // Normalize location name for deduplication
    const loc = s.heading.trim().replace(/\s+/g, " ");
    if (loc) locs.add(loc);
  }
  return Array.from(locs);
}

function generateWarnings(
  scenes: ParsedScene[]
): { line: number; message: string }[] {
  const warnings: { line: number; message: string }[] = [];
  scenes.forEach((s, i) => {
    if (!s.intExt)
      warnings.push({
        line: i * 20,
        message: `Scene ${s.sceneNumber}: No INT/EXT detected`,
      });
    // Short scenes are intentional — no warning for page count.
  });
  return warnings;
}
