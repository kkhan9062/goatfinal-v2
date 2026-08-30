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

// 1 CSS px = 25.4mm / 96dpi — standard CSS-to-physical conversion, used to
// size PDF pages and reason about exported image dimensions in real units.
const MM_PER_PX = 25.4 / 96;

// Images captured at their live on-page width can end up far wider than a
// phone screen (e.g. a card living in a desktop-width grid column), which
// then forces horizontal AND vertical scrolling to view a single exported
// PNG on mobile — caught from user feedback after the first version of
// this export shipped. Capturing at this width instead (matching v1's own
// WhatsApp-friendly capture width) keeps a single card viewable at a glance
// on a phone without pinch-zooming or scrolling.
const COMPACT_CAPTURE_WIDTH_PX = 420;

/**
 * Captures an offscreen CLONE appended directly to document.body, rather
 * than the live element in place — same technique v1 used for its combined
 * bill screenshot capture (captureCombinedRetailerCanvas). Keeps the
 * capture's layout independent of the live page's scroll position/visible
 * viewport, and matches export-target components (BillDetailView's print
 * area, RetailerCard) which use plain inline hex styles rather than
 * Tailwind color classes, as a second layer of safety against this same
 * class of renderer-compatibility issue in the future.
 *
 * `widthPx`, when given, forces the clone to reflow at that CSS width
 * before capture (see COMPACT_CAPTURE_WIDTH_PX) instead of the element's
 * natural on-page width.
 */
async function captureCanvas(
  element: HTMLElement,
  { scale = 2, widthPx }: { scale?: number; widthPx?: number } = {}
): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.background = '#ffffff';
  host.style.width = widthPx ? `${widthPx}px` : `${element.scrollWidth}px`;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  if (widthPx) {
    clone.style.width = '100%';
  }
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
      // Interactive controls that live inside an otherwise-captured area
      // (e.g. Combined Bill's "Edit Entries" button on each retailer card)
      // opt out of the exported PDF/image via this attribute — they're UI
      // chrome for the live page, not part of the document being printed.
      ignoreElements: (el) => el.hasAttribute('data-pdf-ignore'),
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

/**
 * Renders `element` to a PDF and downloads it. Content that fits on one
 * page gets a page sized exactly to that content (in real mm, via the
 * standard 96dpi CSS-px conversion) — no wasted A4 whitespace around a
 * short bill or statement. Content taller than a comfortable single page
 * falls back to standard A4-width pagination.
 */
export async function exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const scale = 2;
  const canvas = await captureCanvas(element, { scale });
  const imgData = canvas.toDataURL('image/png');

  const contentWidthMm = (canvas.width / scale) * MM_PER_PX;
  const contentHeightMm = (canvas.height / scale) * MM_PER_PX;

  // A generous single-page ceiling (~A3 height) — beyond this, a fitted
  // custom page size would print at an awkward scale, so paginate normally.
  const SINGLE_PAGE_MAX_HEIGHT_MM = 400;

  if (contentHeightMm <= SINGLE_PAGE_MAX_HEIGHT_MM) {
    const pdf = new jsPDF({
      orientation: contentWidthMm >= contentHeightMm ? 'l' : 'p',
      unit: 'mm',
      format: [contentWidthMm, contentHeightMm],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, contentWidthMm, contentHeightMm);
    pdf.save(filename);
    return;
  }

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

/** Renders `element` to a compact, mobile-friendly PNG and downloads it. */
export async function exportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureCanvas(element, { scale: 2, widthPx: COMPACT_CAPTURE_WIDTH_PX });
  const blob = await canvasToBlob(canvas);
  triggerDownload(blob, filename);
}

/**
 * Renders `element` to a PNG and copies it straight to the clipboard —
 * v1's "📋 Copy SS" button on each Combined Bill retailer card, for pasting
 * directly into WhatsApp without a save-then-attach round trip. Falls back
 * to downloading the PNG (with `fallbackFilename`) on browsers/contexts
 * where the Clipboard API's image write isn't available (e.g. no
 * ClipboardItem support, or a permissions/HTTPS restriction) — matches v1's
 * fallback exactly, so the button never just silently does nothing.
 */
export async function copyElementToClipboard(
  element: HTMLElement,
  fallbackFilename: string
): Promise<'copied' | 'downloaded'> {
  const canvas = await captureCanvas(element, { scale: 2, widthPx: COMPACT_CAPTURE_WIDTH_PX });
  const blob = await canvasToBlob(canvas);

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      // fall through to download
    }
  }

  triggerDownload(blob, fallbackFilename);
  return 'downloaded';
}

/**
 * Renders each of `elements` to its own compact, mobile-friendly PNG and
 * downloads them together as one ZIP file — the "download all retailer
 * bills as images" feature.
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
        const canvas = await captureCanvas(element, { scale: 2, widthPx: COMPACT_CAPTURE_WIDTH_PX });
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
