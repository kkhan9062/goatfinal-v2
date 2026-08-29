// Client-only helpers for turning a rendered DOM element into a downloadable
// file — direct port of the html2canvas+jsPDF pattern v1 used for the
// Sufiyan Bhai Cash Flow PDF export (scfv2ExportPDF in
// sufiyan-cashflow-v2-module.js), and the html2canvas+JSZip pattern v1 used
// for Combined Bill's "download all retailer bills as PNG" button
// (downloadAllCombinedRetailerBillsZip). Both only ever run in the browser —
// every caller is a 'use client' component's event handler.

// html2canvas-pro, not html2canvas: the original library's hand-rolled CSS
// color parser only understands legacy rgb/hex/hsl and throws ("Attempting
// to parse an unsupported color function") on any oklch/lab color — which
// Tailwind v4's default palette uses throughout, including in the
// stylesheet(s) html2canvas clones wholesale as part of its capture
// process (not just the target element's own styles, so scoping/inlining
// colors on the target didn't help — caught live while testing the bill
// PDF export). html2canvas-pro is a maintained drop-in fork with native
// CSS Color 4 support (oklch, lab, color-mix, etc.) and otherwise the same
// API.
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

// Captures an offscreen CLONE appended directly to document.body, rather
// than the live element in place — same technique v1 used for its combined
// bill screenshot capture (captureCombinedRetailerCanvas). Keeps the
// capture's layout independent of the live page's scroll position/visible
// viewport, and matches export-target components (BillDetailView's print
// area, RetailerCard) which use plain inline hex styles rather than
// Tailwind color classes, as a second layer of safety against this same
// class of renderer-compatibility issue in the future.
async function captureCanvas(element: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.background = '#ffffff';
  host.style.width = `${element.scrollWidth}px`;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    return await html2canvas(host, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: host.scrollWidth,
      windowHeight: host.scrollHeight,
    });
  } finally {
    host.remove();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image from element'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

/** Renders `element` to a single- or multi-page A4 PDF and downloads it. */
export async function exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureCanvas(element);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width;

  let heightLeft = imgHeightMm;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageWidthMm, imgHeightMm);
  heightLeft -= pageHeightMm;

  while (heightLeft > 0) {
    position = heightLeft - imgHeightMm;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageWidthMm, imgHeightMm);
    heightLeft -= pageHeightMm;
  }

  pdf.save(filename);
}

/** Renders `element` to a PNG and downloads it. */
export async function exportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureCanvas(element);
  const blob = await canvasToBlob(canvas);
  triggerDownload(blob, filename);
}

/**
 * Renders each of `elements` to its own PNG and downloads them together as
 * one ZIP file — the "download all retailer bills as images" feature.
 */
export async function exportElementsAsZip(
  elements: { element: HTMLElement; filename: string }[],
  zipFilename: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const BATCH_SIZE = 4;

  let done = 0;
  for (let i = 0; i < elements.length; i += BATCH_SIZE) {
    const batch = elements.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ element, filename }) => {
        const canvas = await captureCanvas(element, 1.75);
        const blob = await canvasToBlob(canvas);
        zip.file(filename, blob);
        done++;
        onProgress?.(done, elements.length);
      })
    );
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  triggerDownload(zipBlob, zipFilename);
}
