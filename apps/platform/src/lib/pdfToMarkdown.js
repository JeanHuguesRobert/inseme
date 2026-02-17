import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

function resolveStandardFontDataUrl() {
  try {
    const pkgPath = require.resolve("pdfjs-dist/package.json");
    const dir = path.join(path.dirname(pkgPath), "standard_fonts") + path.sep; // trailing slash
    return pathToFileURL(dir).href; // file:///.../standard_fonts/
  } catch {
    return undefined;
  }
}

import fs from "node:fs/promises";
import { getDocumentProxy, extractText } from "unpdf";

async function loadCanvasImportIfNode() {
  if (typeof globalThis.process === "undefined") return null;
  if (globalThis.process?.versions?.node == null) return null;
  try {
    const mod = await import("canvas");
    const m = mod?.default ? { ...mod.default, ...mod } : mod;
    if (typeof m.createCanvas !== "function") return null;
    return {
      createCanvas: m.createCanvas,
      Canvas: m.Canvas,
      Image: m.Image,
      loadImage: m.loadImage,
    };
  } catch {
    return null;
  }
}

// Factory polices standard pour pdf.js via FS (évite les URLs file://)
function makeStandardFontDataFactory() {
  const pkgPath = require.resolve("pdfjs-dist/package.json");
  const dir = path.join(path.dirname(pkgPath), "standard_fonts");
  return async (filename) => new Uint8Array(await fs.readFile(path.join(dir, filename)));
}

// CanvasFactory minimal pour pdf.js en Node
function makeCanvasFactory(canvasImport) {
  return {
    create(w, h) {
      const W = Math.ceil(w),
        H = Math.ceil(h);
      const canvas = canvasImport.createCanvas(W, H);
      const context = canvas.getContext("2d");
      return { canvas, context };
    },
    reset(canvas, w, h) {
      canvas.width = Math.ceil(w);
      canvas.height = Math.ceil(h);
    },
    destroy(canvas) {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

// Rend une page du PDF déjà ouvert en image
async function renderPageAsImageFromPdf(
  pdf,
  pageNumber,
  { scale = 2, toDataURL = true, canvasImport }
) {
  if (!canvasImport)
    throw new Error('Parameter "canvasImport" is required in Node.js environment.');
  const canvasFactory = makeCanvasFactory(canvasImport);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
  const out =
    toDataURL && typeof canvas.toDataURL === "function"
      ? canvas.toDataURL("image/png")
      : canvas.toBuffer
        ? canvas.toBuffer("image/png")
        : globalThis.Buffer.from(canvas.toDataURL("image/png").split(",")[1], "base64");
  canvasFactory.destroy(canvas);
  return out;
}

/**
 * Options for the PDF to Markdown conversion helper.
 * @typedef {Object} PdfToMarkdownOptions
 * @property {number} [baseHeadingLevel=2] - Markdown heading level used for detected titles.
 * @property {boolean} [includePageBreaks=true] - When true, inserts a heading before each page section.
 * @property {boolean} [ocrImages=false] - Enables page-level OCR when almost no text is extracted from a page.
 * @property {string|string[]} [ocrLanguages='fra+eng'] - Languages passed to Tesseract when OCR is enabled.
 * @property {number} [ocrTextThreshold=32] - Minimum number of extracted characters required to skip OCR fallback.
 * @property {number} [ocrScale=2] - Rendering scale used before sending a page image to the OCR engine.
 * @property {Object} [ocrParameters] - Optional parameters forwarded to `worker.setParameters`.
 * @property {(markdown: string, context: PdfToMarkdownContext) => Promise<string|PdfToMarkdownAiResult>|string|PdfToMarkdownAiResult} [aiRefiner]
 *   Optional callback used to refine the produced Markdown with an external LLM.
 */

/**
 * @typedef {Object} PdfToMarkdownContext
 * @property {number} totalPages
 * @property {number[]} ocrPages
 * @property {string[]} pageMarkdown
 */

/**
 * @typedef {Object} PdfToMarkdownAiResult
 * @property {string} markdown
 * @property {Record<string, any>} [meta]
 */

export const DEFAULT_OPTIONS = {
  baseHeadingLevel: 2,
  includePageBreaks: true,
  ocrImages: "auto",
  ocrLanguages: "fra",
  ocrTextThreshold: 32,
  ocrScale: 2,
  aiRefiner: null,
  ocrParameters: {
    tessedit_pageseg_mode: "1", // Auto avec OSD
    preserve_interword_spaces: "1", // Crucial pour français
    tessedit_char_whitelist: "", // Retirer si trop restrictif
    textord_heavy_nr: "1", // Meilleure détection colonnes
    language_model_penalty_non_dict_word: "0.5",
    language_model_penalty_non_freq_dict_word: "0.3",
  },
};

/**
 * Converts a PDF buffer or typed array into Markdown text. The function combines
 * native PDF text extraction with an optional OCR fallback (useful for scanned
 * documents or images) and simple heuristics to format headings, bullet lists
 * and paragraphs.
 *
 * @param {ArrayBuffer | Uint8Array | Buffer} pdfData - Raw binary data of the PDF document.
 * @param {PdfToMarkdownOptions} [options]
 * @returns {Promise<{ markdown: string, pages: string[], meta: Record<string, any> }>} markdown result with metadata.
 */

// Global variables for OCR worker
let ocrWorker = null;
let settings = DEFAULT_OPTIONS;

async function ensureOcrWorker() {
  if (ocrWorker) return ocrWorker;
  const { createWorker } = await import("tesseract");
  ocrWorker = await createWorker({ logger: null });

  await ocrWorker.load();

  const langs = Array.isArray(settings.ocrLanguages)
    ? settings.ocrLanguages
    : String(settings.ocrLanguages || "fra")
        .split(/[+,\s]+/)
        .filter(Boolean);

  try {
    await ocrWorker.loadLanguage(langs);
  } catch {
    await ocrWorker.loadLanguage(langs.join("+"));
  }
  try {
    await ocrWorker.initialize(langs);
  } catch {
    await ocrWorker.initialize(langs.join("+"));
  }

  if (settings.ocrParameters) await ocrWorker.setParameters(settings.ocrParameters);
  return ocrWorker;
}

export async function convertPdfToMarkdown(pdfData, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  // Ouverture PDF avec factory de polices standard
  const standardFontDataFactory = makeStandardFontDataFactory();
  const bytes = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
  const pdf = await getDocumentProxy(bytes, { standardFontDataFactory });

  // Extraction texte native
  let { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : String(text || "").split("\f");
  if (!Number.isFinite(totalPages)) totalPages = pdf.numPages || pages.length;

  const pageMarkdown = [];
  const ocrPages = [];
  let ocrWorker = null;

  // Import canvas automatiquement si OCR demandé ou utile
  const autoCanvas = await loadCanvasImportIfNode();
  const enableOcr = (settings.ocrImages === true || settings.ocrImages === "auto") && !!autoCanvas;

  async function ensureOcrWorker() {
    if (ocrWorker) return ocrWorker;
    const { createWorker } = await import("tesseract");
    ocrWorker = await createWorker({ logger: null });
    await ocrWorker.load();
    const langs = Array.isArray(settings.ocrLanguages)
      ? settings.ocrLanguages
      : String(settings.ocrLanguages || "fra")
          .split(/[+,\s]+/)
          .filter(Boolean);
    try {
      await ocrWorker.loadLanguage(langs);
    } catch {
      await ocrWorker.loadLanguage(langs.join("+"));
    }
    try {
      await ocrWorker.initialize(langs);
    } catch {
      await ocrWorker.initialize(langs.join("+"));
    }
    if (settings.ocrParameters) await ocrWorker.setParameters(settings.ocrParameters);
    return ocrWorker;
  }

  try {
    for (let i = 0; i < pages.length; i++) {
      const pageNumber = i + 1;
      let pageText = sanitisePageText(pages[i] ?? "");

      if (enableOcr && needsOcr(pageText, settings.ocrTextThreshold)) {
        try {
          const dataUrl = await renderPageAsImageFromPdf(pdf, pageNumber, {
            scale: settings.ocrScale,
            toDataURL: true,
            canvasImport: autoCanvas,
          });
          const worker = await ensureOcrWorker();
          const {
            data: { text },
          } = await worker.recognize(dataUrl);
          if ((text || "").trim()) {
            pageText = text;
            ocrPages.push(pageNumber);
          }
        } catch (e) {
          console.warn(`OCR fallback failed on page ${pageNumber}:`, e);
        }
      }

      pageMarkdown.push(formatPage(pageText, pageNumber, settings));
    }
  } finally {
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch {}
    }
  }

  let markdown = composeDocument(pageMarkdown, settings);

  if (typeof settings.aiRefiner === "function") {
    const ctx = { totalPages, ocrPages, pageMarkdown };
    const refined = await settings.aiRefiner(markdown, ctx);
    if (typeof refined === "string") markdown = refined;
    else if (refined && typeof refined === "object") {
      if (typeof refined.markdown === "string") markdown = refined.markdown;
      // optional meta
    }
  }

  return { markdown, pages: pageMarkdown, meta: { totalPages, ocrPages } };
}

async function runOcrOnPage(pdf, pageNumber, opts, workerFactory) {
  try {
    const dataUrl = await renderPageAsImageFromPdf(pdf, pageNumber, {
      scale: opts.ocrScale,
      toDataURL: true,
      canvasImport: opts.canvasImport,
    });
    const worker = await workerFactory();
    const {
      data: { text },
    } = await worker.recognize(dataUrl);
    return text;
  } catch (error) {
    console.warn(`OCR fallback failed on page ${pageNumber}:`, error);
    return "";
  }
}

export function composeDocument(pageMarkdown, settings) {
  if (!settings.includePageBreaks) {
    return pageMarkdown.join("\n\n");
  }
  return pageMarkdown
    .map((content, index) => {
      const headingLevel = Math.max(1, settings.baseHeadingLevel - 1);
      const prefix = "#".repeat(headingLevel);
      return `${prefix} Page ${index + 1}\n\n${content}`.trim();
    })
    .join("\n\n---\n\n");
}

export function needsOcr(text, threshold) {
  return text.replace(/\s+/g, "").length < threshold;
}

export function formatPage(text, pageNumber, settings) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0));

  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = null;

  const pushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push(joinParagraphLines(paragraphBuffer));
    paragraphBuffer = [];
  };

  const pushList = () => {
    if (!listBuffer || !listBuffer.items.length) return;
    const marker = listBuffer.kind === "ordered" ? "1." : "-";
    const listMarkdown = listBuffer.items
      .map((item, idx) => {
        if (listBuffer.kind === "ordered") {
          return `${listBuffer.start + idx}. ${item}`;
        }
        return `${marker} ${item}`;
      })
      .join("\n");
    blocks.push(listMarkdown);
    listBuffer = null;
  };

  lines.forEach((line) => {
    if (!line.length) {
      pushParagraph();
      pushList();
      return;
    }

    if (isProbableHeading(line)) {
      pushParagraph();
      pushList();
      const headingLevel = "#".repeat(settings.baseHeadingLevel);
      blocks.push(`${headingLevel} ${normaliseHeading(line)}`);
      return;
    }

    const listMatch = parseListLine(line);
    if (listMatch) {
      pushParagraph();
      if (!listBuffer || listBuffer.kind !== listMatch.kind) {
        pushList();
        listBuffer = { ...listMatch, items: [] };
      }
      if (listBuffer.kind === "ordered" && typeof listBuffer.start !== "number") {
        listBuffer.start = listMatch.start ?? 1;
      }
      listBuffer.items.push(listMatch.content);
      return;
    }

    pushList();
    paragraphBuffer.push(line);
  });

  pushParagraph();
  pushList();

  return blocks.join("\n\n").trim();
}

export function sanitisePageText(text) {
  return text
    .replace(new RegExp(String.fromCharCode(0), "g"), "")
    .replace(/\f/g, "\n")
    .replace(/\s+$/gm, "")
    .trim();
}

export function joinParagraphLines(lines) {
  return lines.reduce((acc, line) => {
    if (!acc) return line;
    if (/[-–—]$/.test(acc)) {
      return acc.replace(/[-–—]$/, "") + line.replace(/^\s+/, "");
    }
    if (/^[,.;:!?]/.test(line)) {
      return `${acc}${line}`;
    }
    return `${acc} ${line}`;
  }, "");
}

export function isProbableHeading(line) {
  if (line.length < 3) return false;
  if (/^(ARTICLE|CHAPITRE|SECTION)\s+\d+/i.test(line)) return true;
  const words = line.split(/\s+/);
  const letters = line.replace(/[^A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸa-zàâäçéèêëïîôöùûüÿ]/g, "");
  if (letters.length === 0) return false;
  const averageLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const uppercaseRatio = line.replace(/[^A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸ]/g, "").length / letters.length;
  return uppercaseRatio > 0.6 && averageLength < 12;
}

export function normaliseHeading(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseListLine(line) {
  const bulletMatch = line.match(/^([-*•●▪◦])\s+(.*)$/);
  if (bulletMatch) {
    return {
      kind: "unordered",
      content: bulletMatch[1].trim(),
    };
  }
  const orderedMatch = line.match(/^(\d+)[.]\s+(.*)$/);
  if (orderedMatch) {
    return {
      kind: "ordered",
      start: Number.parseInt(orderedMatch[1], 10),
      content: orderedMatch[1].trim(),
    };
  }
  return null;
}

export default convertPdfToMarkdown;
