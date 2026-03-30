"use client";

/**
 * Script Parser — Extracts scenes from screenplay PDF text.
 * Works with standard screenplay format:
 *   INT. COFFEE SHOP - DAY
 *   EXT. HIGHWAY - NIGHT
 */

export interface ParsedScene {
    sceneNumber: string;
    sceneName: string;
    intExt: string;
    dayNight: string;
    synopsis: string;
    pageCount: number;
}

/**
 * Extract text from a PDF file using pdfjs-dist.
 * Disables the worker to avoid module import issues with Turbopack/Next.js.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    // Polyfill Promise.try for Safari (pdfjs-dist v5 requires it)
    if (typeof (Promise as unknown as { try: unknown }).try !== "function") {
        (Promise as unknown as Record<string, unknown>).try = function <T>(fn: () => T): Promise<T> {
            try {
                return Promise.resolve(fn());
            } catch (error) {
                return Promise.reject(error);
            }
        };
    }

    const pdfjsLib = await import("pdfjs-dist");

    // Point to the worker file copied to /public
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Reconstruct text preserving line breaks based on Y-position changes
        let lastY: number | null = null;
        let pageText = "";
        for (const item of textContent.items) {
            if (!("str" in item)) continue;
            const textItem = item as { str: string; transform: number[] };
            const y = textItem.transform[5];
            if (lastY !== null && Math.abs(y - lastY) > 2) {
                pageText += "\n";
            }
            pageText += textItem.str;
            lastY = y;
        }
        fullText += pageText + "\n\n";
    }

    return fullText;
}

/**
 * Parse screenplay text into scene objects.
 * Detects standard scene headings like:
 *   INT. COFFEE SHOP - DAY
 *   EXT. HIGHWAY - NIGHT
 *   INT/EXT. CAR - CONTINUOUS
 */
export function parseScenesFromText(text: string): ParsedScene[] {
    const scenes: ParsedScene[] = [];

    // Scene heading regex — matches INT./EXT./INT/EXT. patterns
    // Scene number captures: "1", "1A", "12B", "1-A", "1.1" etc.
    // Also handles trailing scene numbers on shooting scripts
    // Group 1: leading scene number, Group 5: trailing scene number
    // \s* after INT/EXT to handle PDF "INT.LOCATION" (no space)
    const headingRegex =
        /(?:^|\n)\s*(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)?\s*\.?\s*(INT|EXT|INT\/EXT|I\/E)\.?\s*(.+?)[-–—]\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|EVENING|MORNING|LATER|SAME TIME|MAGIC HOUR)\s*(\d+[A-Za-z]*(?:[.-]\d+)?[A-Za-z]?)?(?:\s+\d+[A-Za-z]*)?\s*$/gim;

    const matches: { index: number; sceneNumber: string; intExt: string; sceneName: string; dayNight: string }[] = [];

    let match;
    while ((match = headingRegex.exec(text)) !== null) {
        matches.push({
            index: match.index,
            sceneNumber: match[1] || match[5] || "",
            intExt: match[2].toUpperCase().replace("I/E", "INT/EXT"),
            sceneName: match[3].trim().replace(/\s+/g, " "),
            dayNight: normalizeDayNight(match[4]),
        });
    }

    // Extract synopsis (action text between scene headings)
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const startIdx = m.index + text.substring(m.index).indexOf("\n") + 1;
        const endIdx = i + 1 < matches.length ? matches[i + 1].index : text.length;
        const bodyText = text.substring(startIdx, endIdx).trim();

        // Extract first 2 lines of action as synopsis (skip character names & dialogue)
        const lines = bodyText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.match(/^[A-Z\s]{2,}$/) && !l.startsWith("("))
            .slice(0, 2);

        const synopsis = lines.join(" ").substring(0, 200);

        // Estimate page count from character length (~3000 chars per script page)
        const charCount = bodyText.length;
        const estimatedPages = Math.max(0.125, Math.round((charCount / 3000) * 8) / 8);

        scenes.push({
            sceneNumber: m.sceneNumber || String(i + 1),
            sceneName: m.sceneName,
            intExt: m.intExt,
            dayNight: m.dayNight,
            synopsis,
            pageCount: estimatedPages,
        });
    }

    return scenes;
}

function normalizeDayNight(val: string): string {
    const upper = val.toUpperCase();
    if (["CONTINUOUS", "LATER", "SAME TIME"].includes(upper)) return "DAY";
    if (["EVENING", "MAGIC HOUR"].includes(upper)) return "NIGHT";
    if (upper === "MORNING") return "DAY";
    return upper; // DAY, NIGHT, DAWN, DUSK
}
