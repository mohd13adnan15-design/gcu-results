import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createRoot } from "react-dom/client";

import {
  GradeCardDocument,
  type GradeCardDocumentHandle,
} from "@/features/marks/GradeCardDocument";
import { buildGradeCardFrontPages } from "@/lib/grade-card-filter";
import { A4_HEIGHT, A4_WIDTH } from "@/lib/grade-card-constants";
import type { BackPageSignatureOptions, MarksheetDocumentOptions } from "@/lib/marksheet-documents";
import type { StudentMarksheet } from "@/lib/marksheet";

/** html2canvas cannot parse modern CSS color functions from app stylesheets (e.g. oklch). */
function prepareDocumentCloneForCanvas(clonedDoc: Document) {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
  clonedDoc.documentElement.style.background = "#f6f3eb";
  if (clonedDoc.body) {
    clonedDoc.body.style.background = "#f6f3eb";
    clonedDoc.body.style.margin = "0";
    clonedDoc.body.style.padding = "0";
  }
}

async function waitForImages(container: HTMLElement, timeoutMs = 8000) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, timeoutMs);
        }),
    ),
  );
  await new Promise((r) => window.setTimeout(r, 150));
}

export async function capturePagesToPdf(pageElements: HTMLElement[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  for (let i = 0; i < pageElements.length; i++) {
    if (i > 0) doc.addPage();
    const element = pageElements[i];
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#f6f3eb",
      width: A4_WIDTH,
      height: A4_HEIGHT,
      windowWidth: A4_WIDTH,
      windowHeight: A4_HEIGHT,
      onclone: prepareDocumentCloneForCanvas,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    doc.addImage(imgData, "JPEG", 0, 0, A4_WIDTH, A4_HEIGHT);
  }

  return doc.output("blob");
}

type RenderPdfOptions = {
  frontPages: StudentMarksheet[];
  photoUrl?: string | null;
  backPageSignatures?: BackPageSignatureOptions;
};

function OffscreenCapture({
  options,
  onCaptured,
  onError,
}: {
  options: RenderPdfOptions;
  onCaptured: (pages: HTMLElement[]) => void;
  onError: (error: unknown) => void;
}) {
  const docRef = useRef<GradeCardDocumentHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await waitForImages(containerRef.current ?? document.body);
        if (cancelled) return;
        const pages = docRef.current?.getPageElements() ?? [];
        onCaptured(pages);
      } catch (error) {
        if (!cancelled) onError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot offscreen capture
  }, []);

  return (
    <div ref={containerRef}>
      <GradeCardDocument
        ref={docRef}
        frontPages={options.frontPages}
        photoUrl={options.photoUrl}
        backPageSignatures={options.backPageSignatures}
        captureMode
      />
    </div>
  );
}

async function renderGradeCardPdfOffscreen(options: RenderPdfOptions): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const pageElements = await new Promise<HTMLElement[]>((resolve, reject) => {
      const root = createRoot(container);
      root.render(
        <OffscreenCapture
          options={options}
          onCaptured={(pages) => {
            root.unmount();
            resolve(pages);
          }}
          onError={(error) => {
            root.unmount();
            reject(error);
          }}
        />,
      );
    });

    return await capturePagesToPdf(pageElements);
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateGradeCardPdfFromDocument(
  pageElements: HTMLElement[],
): Promise<Blob> {
  if (pageElements.length === 0) {
    throw new Error("No grade card pages to export.");
  }

  const wrappers = pageElements.map((el) => el.parentElement);
  const prevDisplay = wrappers.map((w) => w?.style.display ?? "");
  for (const wrapper of wrappers) {
    if (wrapper) wrapper.style.display = "block";
  }

  try {
    const root = pageElements[0]?.closest(".grade-card-document") ?? pageElements[0];
    await waitForImages(root as HTMLElement);
    return capturePagesToPdf(pageElements);
  } finally {
    wrappers.forEach((wrapper, index) => {
      if (wrapper) wrapper.style.display = prevDisplay[index];
    });
  }
}

export async function generateMarksheetPdfFromTemplate(
  marksheet: StudentMarksheet,
  options: MarksheetDocumentOptions = {},
): Promise<Blob> {
  const allSheets = options.allMarksheets ?? [marksheet];
  const frontPages = buildGradeCardFrontPages(marksheet, allSheets, false);
  if (frontPages.length === 0) {
    throw new Error("No grade card data to generate.");
  }
  return renderGradeCardPdfOffscreen({
    frontPages,
    photoUrl: options.photoUrl,
    backPageSignatures: options.backPageSignatures,
  });
}

export async function generateAllSemestersPdfFromTemplate(
  marksheets: StudentMarksheet[],
  options: MarksheetDocumentOptions = {},
): Promise<Blob> {
  if (marksheets.length === 0) {
    throw new Error("No grade card data to generate.");
  }
  const sorted = [...marksheets].sort(
    (a, b) => parseSemesterOrder(a.semester_label) - parseSemesterOrder(b.semester_label),
  );
  const frontPages = sorted
    .map((sheet) => buildGradeCardFrontPages(sheet, marksheets, false)[0])
    .filter((sheet): sheet is StudentMarksheet => Boolean(sheet));

  return renderGradeCardPdfOffscreen({
    frontPages,
    photoUrl: options.photoUrl,
    backPageSignatures: options.backPageSignatures,
  });
}

function parseSemesterOrder(label: string): number {
  const clean = (label || "").toUpperCase().trim();
  const order: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  };
  const norm = clean.replace(/^SEM\s+/, "");
  return order[norm] ?? 99;
}
