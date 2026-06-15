import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createRoot, type Root } from "react-dom/client";

import { DegreeCertificateDocument } from "@/features/degree-certificate/DegreeCertificateDocument";
import {
  DEGREE_CERT_A4_HEIGHT,
  DEGREE_CERT_A4_WIDTH,
  DEGREE_CERTIFICATE_FONTS,
} from "@/lib/degree-certificate/constants";
import type { DegreeCertificateView } from "@/lib/degree-certificate/types";

const CAPTURE_SCALE = 2;

const KANNADA_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+Kannada:wght@400;700&display=swap";

const RENDERED_STYLE_PROPS = [
  "align-items",
  "background-color",
  "border",
  "border-bottom",
  "border-left",
  "border-right",
  "border-top",
  "border-color",
  "border-style",
  "border-width",
  "bottom",
  "box-sizing",
  "color",
  "display",
  "flex-direction",
  "flex-shrink",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "overflow",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "right",
  "text-align",
  "top",
  "transform",
  "transform-origin",
  "white-space",
  "width",
  "z-index",
] as const;

function copyRenderedStyles(source: Element, target: Element) {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return;

  const computed = window.getComputedStyle(source);
  for (const prop of RENDERED_STYLE_PROPS) {
    target.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  for (let index = 0; index < sourceChildren.length; index += 1) {
    if (targetChildren[index]) {
      copyRenderedStyles(sourceChildren[index], targetChildren[index]);
    }
  }
}

function syncImagesFromSource(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sourceImages = Array.from(sourceRoot.querySelectorAll("img"));
  const cloneImages = Array.from(cloneRoot.querySelectorAll("img"));
  cloneImages.forEach((img, index) => {
    const original = sourceImages[index];
    if (!original?.src) return;
    img.src = original.src;
    if (original.crossOrigin) img.crossOrigin = original.crossOrigin;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Inline images as data URLs so html2canvas export is never tainted. Restores originals after capture. */
async function inlineImagesForCapture(root: HTMLElement): Promise<() => void> {
  const restores: Array<() => void> = [];
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const originalSrc = img.src;
      if (!originalSrc || originalSrc.startsWith("data:") || originalSrc.startsWith("blob:")) {
        return;
      }

      try {
        const response = await fetch(originalSrc, { mode: "cors", credentials: "omit" });
        if (!response.ok) return;
        const dataUrl = await blobToDataUrl(await response.blob());
        img.src = dataUrl;
        img.crossOrigin = "anonymous";
        restores.push(() => {
          img.src = originalSrc;
          img.removeAttribute("crossorigin");
        });
      } catch {
        // Keep original src — same-origin assets still render.
      }
    }),
  );

  return () => {
    for (const restore of restores) restore();
  };
}

async function waitForWebFonts() {
  if (!document.fonts?.ready) return;
  await document.fonts.ready;
  const kannada = DEGREE_CERTIFICATE_FONTS.kannada.replace(/"/g, "'");
  await Promise.all([
    document.fonts.load(`700 22px ${kannada}`).catch(() => undefined),
    document.fonts.load(`400 11px Georgia`).catch(() => undefined),
    document.fonts.load(`400 6pt "Times New Roman"`).catch(() => undefined),
  ]);
}

export async function waitForDegreeCertificateAssets(
  container: HTMLElement,
  timeoutMs = 12000,
) {
  await waitForWebFonts();

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

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const backQr = container.querySelector(
      '[data-degree-certificate-page="back"] img[src^="data:"]',
    );
    if (backQr) break;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  await new Promise((resolve) => window.setTimeout(resolve, 250));
}

function stripPresentationClasses(root: HTMLElement) {
  root.removeAttribute("class");
  root.querySelectorAll<HTMLElement>("[class]").forEach((el) => el.removeAttribute("class"));
}

async function waitForIframeFonts(iframeDoc: Document) {
  try {
    await iframeDoc.fonts?.ready;
  } catch {
    // ignore
  }
  await new Promise((resolve) => window.setTimeout(resolve, 150));
}

/**
 * Capture in an isolated iframe so html2canvas never parses the app's Tailwind
 * stylesheets (oklch colors crash html2canvas on the main document).
 */
async function capturePageWysiwyg(sourcePage: HTMLElement): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${DEGREE_CERT_A4_WIDTH}px;height:${DEGREE_CERT_A4_HEIGHT}px;border:0;visibility:hidden;`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error("Could not initialize degree certificate PDF capture frame.");
  }

  iframeDoc.open();
  iframeDoc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${KANNADA_FONT_URL}"></head><body style="margin:0;padding:0;background:#ffffff"></body></html>`,
  );
  iframeDoc.close();

  const clone = sourcePage.cloneNode(true) as HTMLElement;
  copyRenderedStyles(sourcePage, clone);
  syncImagesFromSource(sourcePage, clone);
  stripPresentationClasses(clone);
  clone.style.width = `${DEGREE_CERT_A4_WIDTH}px`;
  clone.style.height = `${DEGREE_CERT_A4_HEIGHT}px`;
  clone.style.position = "relative";
  clone.style.overflow = "hidden";
  clone.style.backgroundColor = "#ffffff";
  iframeDoc.body.appendChild(clone);

  await waitForIframeFonts(iframeDoc);

  try {
    return await html2canvas(clone, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      logging: false,
      width: DEGREE_CERT_A4_WIDTH,
      height: DEGREE_CERT_A4_HEIGHT,
      windowWidth: DEGREE_CERT_A4_WIDTH,
      windowHeight: DEGREE_CERT_A4_HEIGHT,
    });
  } finally {
    iframe.remove();
  }
}

export async function captureDegreeCertificateToPdf(pageElements: HTMLElement[]): Promise<Blob> {
  if (pageElements.length === 0) {
    throw new Error("No degree certificate pages to export.");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  for (let index = 0; index < pageElements.length; index += 1) {
    const canvas = await capturePageWysiwyg(pageElements[index]);
    if (index > 0) doc.addPage();
    doc.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      DEGREE_CERT_A4_WIDTH,
      DEGREE_CERT_A4_HEIGHT,
    );
  }

  return doc.output("blob");
}

function collectCertificatePages(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-degree-certificate-page]"));
}

export async function generateDegreeCertificatePdfFromPreview(
  previewRoot: HTMLElement,
): Promise<Blob> {
  const pages = collectCertificatePages(previewRoot);
  if (pages.length === 0) {
    throw new Error("No degree certificate pages to export.");
  }

  await waitForDegreeCertificateAssets(previewRoot);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const restoreImages = await inlineImagesForCapture(previewRoot);
  try {
    return await captureDegreeCertificateToPdf(pages);
  } finally {
    restoreImages();
  }
}

function OffscreenDegreeCapture({
  data,
  onCaptured,
  onError,
}: {
  data: DegreeCertificateView;
  onCaptured: (pages: HTMLElement[]) => void;
  onError: (error: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const container = containerRef.current;
        if (!container) {
          onError(new Error("Degree certificate mount not ready."));
          return;
        }
        await waitForDegreeCertificateAssets(container);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        if (cancelled) return;
        const pages = collectCertificatePages(container);
        if (pages.length === 0) {
          onError(new Error("No degree certificate pages to export."));
          return;
        }
        onCaptured(pages);
      } catch (error) {
        if (!cancelled) onError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, onCaptured, onError]);

  return (
    <div
      ref={containerRef}
      style={{
        width: DEGREE_CERT_A4_WIDTH,
        margin: 0,
        padding: 0,
        background: "#ffffff",
      }}
    >
      <DegreeCertificateDocument data={data} />
    </div>
  );
}

async function renderDegreeCertificatePdfOffscreen(data: DegreeCertificateView): Promise<Blob> {
  const mount = document.createElement("div");
  mount.style.cssText = `position:fixed;left:0;top:0;width:${DEGREE_CERT_A4_WIDTH}px;opacity:0;pointer-events:none;z-index:-9999;overflow:visible;background:#ffffff;`;
  document.body.appendChild(mount);

  let root: Root | null = null;

  try {
    const pageElements = await new Promise<HTMLElement[]>((resolve, reject) => {
      root = createRoot(mount);
      root.render(
        <OffscreenDegreeCapture data={data} onCaptured={resolve} onError={reject} />,
      );
    });

    const restoreImages = await inlineImagesForCapture(mount);
    try {
      return await captureDegreeCertificateToPdf(pageElements);
    } finally {
      restoreImages();
    }
  } finally {
    root?.unmount();
    mount.remove();
  }
}

export async function generateDegreeCertificatePdf(data: DegreeCertificateView): Promise<Blob> {
  return renderDegreeCertificatePdfOffscreen(data);
}

export async function generateDegreeCertificatePdfFromElement(
  element: HTMLElement,
): Promise<Blob> {
  return generateDegreeCertificatePdfFromPreview(element);
}
