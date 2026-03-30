import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/extract-pdf
 * Accepts a PDF file upload (multipart/form-data) and returns extracted text.
 * Uses pdfjs-dist legacy build which works in Node.js without browser APIs.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Please upload a valid PDF file" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Use legacy build — works in Node.js without DOMMatrix/Canvas
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const path = await import("path");

    // Point worker to the actual file — works on Vercel because pdfjs-dist is in node_modules
    const workerPath = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

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

    return NextResponse.json({ text: fullText, pages: pdf.numPages });
  } catch (err) {
    console.error("[extract-pdf] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF extraction failed" },
      { status: 500 }
    );
  }
}
