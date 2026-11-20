// Builds exam-style PDFs (paper + markscheme) in the browser with jsPDF.
import { texToPlain } from "./util.js";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const NAVY = [19, 35, 58], TEAL = [14, 159, 142], SLATE = [91, 101, 117], LINE = [210, 205, 195];
const PAGE_W = 210, PAGE_H = 297, M = 20, CW = PAGE_W - 2 * M, BOTTOM = PAGE_H - 22;

let jsPDFReady = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  jsPDFReady ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = JSPDF_URL;
    s.onload = () => res(window.jspdf.jsPDF);
    s.onerror = () => rej(new Error("Could not load the PDF library. Check your internet connection."));
    document.head.appendChild(s);
  });
  return jsPDFReady;
}

const fontCache = {};
async function fontB64(file) {
  if (fontCache[file]) return fontCache[file];
  const buf = await (await fetch(`assets/brand/fonts/${file}`)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (fontCache[file] = btoa(bin));
}

async function loadImage(url) {
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = dataUrl; });
  if (/svg/.test(blob.type)) {
    // jsPDF cannot embed SVG; rasterise it first.
    const c = document.createElement("canvas");
    c.width = img.naturalWidth * 3; c.height = img.naturalHeight * 3;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight, fmt: "PNG" };
  }
  return { dataUrl, w: img.naturalWidth, h: img.naturalHeight, fmt: /png/.test(blob.type) ? "PNG" : "JPEG" };
}

const plain = (s) => texToPlain(s || "").replace(/\*(.+?)\*/g, "$1");

export async function downloadPaperPDF(meta, questions, { markscheme = false } = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const [interR, interB, sgB] = await Promise.all([fontB64("Inter-Regular.ttf"), fontB64("Inter-SemiBold.ttf"), fontB64("SpaceGrotesk-Bold.ttf")]);
  doc.addFileToVFS("Inter-Regular.ttf", interR); doc.addFont("Inter-Regular.ttf", "Inter", "normal");
  doc.addFileToVFS("Inter-SemiBold.ttf", interB); doc.addFont("Inter-SemiBold.ttf", "Inter", "bold");
  doc.addFileToVFS("SpaceGrotesk-Bold.ttf", sgB); doc.addFont("SpaceGrotesk-Bold.ttf", "SG", "bold");

  let y = M;
  const newPage = () => { doc.addPage(); y = M; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };
  const setFont = (family, style, size, color = NAVY) => { doc.setFont(family, style); doc.setFontSize(size); doc.setTextColor(...color); };
  const lineH = (size) => size * 0.3528 * 1.45;

  /** Write wrapped text, breaking pages as needed. Returns nothing; moves y. */
  function write(text, { x = M, width = CW, size = 10.5, family = "Inter", style = "normal", color = NAVY, after = 2 } = {}) {
    setFont(family, style, size, color);
    const paragraphs = String(text).split(/\n/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para || " ", width);
      for (const ln of lines) {
        ensure(lineH(size));
        doc.text(ln, x, y + lineH(size) * 0.75);
        y += lineH(size);
      }
    }
    y += after;
  }

  async function image(url, x) {
    try {
      const img = await loadImage(url);
      const maxW = PAGE_W - M - x, maxH = 85;
      let w = Math.min(maxW, img.w * 0.26), h = (w * img.h) / img.w;
      if (h > maxH) { h = maxH; w = (h * img.w) / img.h; }
      ensure(h + 4);
      doc.addImage(img.dataUrl, img.fmt, x, y, w, h);
      y += h + 4;
    } catch { write("[diagram could not be loaded]", { x, size: 9, color: SLATE }); }
  }

  function marksTag(n) {
    setFont("SG", "bold", 10.5);
    doc.text(`[${n}]`, PAGE_W - M, y - 2, { align: "right" });
  }

  function answerLines(marks) {
    const n = Math.min(14, Math.max(2, Math.round(marks * 2)));
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.setLineDashPattern([0.6, 1.2], 0);
    for (let i = 0; i < n; i++) {
      ensure(8);
      y += 8;
      doc.line(M + 8, y, PAGE_W - M, y);
    }
    doc.setLineDashPattern([], 0);
    y += 4;
  }

  // ----- Cover header -----
  const logo = await loadImage("assets/brand/IBCommons-horizontal-color.png").catch(() => null);
  if (logo) doc.addImage(logo.dataUrl, "PNG", M, y, 42, (42 * logo.h) / logo.w);
  setFont("Inter", "bold", 8, TEAL);
  doc.text(markscheme ? "MARKSCHEME" : "PRACTICE PAPER", PAGE_W - M, y + 6, { align: "right" });
  y += 22;
  const title = `${meta.subject} · ${meta.program}${meta.level ? " " + meta.level : ""}`;
  write(title, { family: "SG", style: "bold", size: 20, after: 1 });
  write(`${meta.paper}${markscheme ? " — Markscheme" : ""}`, { family: "SG", style: "bold", size: 13, color: TEAL, after: 3 });
  write(`Sub-topics: ${meta.topics}`, { size: 9.5, color: SLATE, after: 0 });
  write(`${questions.length} questions · ${meta.marks} marks${markscheme ? "" : ` · suggested time ${meta.minutes} minutes`}`, { size: 9.5, color: SLATE, after: 5 });

  if (!markscheme) {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 14, 2, 2);
    setFont("Inter", "normal", 9.5, SLATE);
    doc.text("Name:", M + 4, y + 8.5); doc.text("Date:", M + 110, y + 8.5);
    doc.line(M + 17, y + 9.5, M + 100, y + 9.5); doc.line(M + 121, y + 9.5, PAGE_W - M - 4, y + 9.5);
    y += 20;
    write("Instructions", { family: "SG", style: "bold", size: 11, after: 1 });
    const instr = questions[0]?.isMCQ
      ? ["Answer all questions.", "For each question, choose the answer you consider to be the best and circle its letter."]
      : ["Answer all questions.", "Write your answers in the spaces provided.", "Show your working: marks are given for correct method.", "The maximum mark for each part is shown in brackets [ ]."];
    instr.forEach((t) => write("•  " + t, { size: 9.5, color: SLATE, after: 0.5 }));
  } else {
    write("How to use this markscheme", { family: "SG", style: "bold", size: 11, after: 1 });
    write("Each marking point is worth one mark unless stated. Accept equivalent answers and correct alternative methods. Apply error carried forward (ECF) where a wrong earlier answer is used correctly.", { size: 9.5, color: SLATE });
  }
  y += 4;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, PAGE_W - M, y);
  y += 8;

  // ----- Questions -----
  for (const [i, q] of questions.entries()) {
    ensure(24);
    setFont("SG", "bold", 12);
    doc.text(`${i + 1}.`, M, y + 4);
    const startY = y;
    if (!markscheme) {
      if (q.stem) write(plain(q.stem), { x: M + 8, width: CW - 20 });
      if (q.image) await image(q.image, M + 8);
      if (q.isMCQ) {
        if (y === startY) y += 5;
        q.options.forEach((o, k) => write(`${String.fromCharCode(65 + k)}.   ${plain(o)}`, { x: M + 12, width: CW - 24, after: 1.2 }));
        marksTag(q.marks);
        y += 4;
      } else {
        for (const p of q.parts) {
          if (p.label) {
            ensure(14);
            setFont("Inter", "bold", 10.5);
            doc.text(`(${p.label})`, M + 8, y + 4);
          }
          if (p.text) write(plain(p.text), { x: M + 18, width: CW - 30 });
          if (p.image) await image(p.image, M + 18);
          marksTag(p.marks);
          answerLines(p.marks);
        }
      }
    } else {
      if (q.isMCQ) {
        write(`Answer: ${q.answer}`, { x: M + 8, family: "Inter", style: "bold", size: 11, after: 1 });
        (q.markscheme || []).forEach((m) => write("•  " + plain(m), { x: M + 8, width: CW - 20, size: 9.5, color: SLATE, after: 0.5 }));
        marksTag(q.marks);
        y += 4;
      } else {
        if (q.stem && q.parts.length && !q.parts[0].label) y += 6;
        for (const p of q.parts) {
          ensure(12);
          if (p.label) { setFont("Inter", "bold", 10.5); doc.text(`(${p.label})`, M + 8, y + 4); }
          const pts = p.markscheme?.length ? p.markscheme : ["See model answer."];
          pts.forEach((m) => write("•  " + plain(m), { x: M + 18, width: CW - 34, size: 10, after: 0.8 }));
          if (p.answer && typeof p.answer === "object" && p.answer.value !== undefined) {
            write(`Final answer: ${p.answer.value}${p.answer.unit ? " " + plain("$" + p.answer.unit + "$") : ""}`, { x: M + 18, size: 9.5, color: TEAL, after: 0.5 });
          }
          marksTag(p.marks);
          y += 3;
        }
        if (q.parts.length > 1) write(`Total: ${q.marks} marks`, { x: M + 8, size: 9, color: SLATE });
      }
    }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y, PAGE_W - M, y);
    y += 7;
  }

  // ----- Footer on every page -----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setFont("Inter", "normal", 7.5, SLATE);
    doc.text("IBCommons · open-source practice material · not affiliated with or endorsed by the International Baccalaureate Organization", M, PAGE_H - 10);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 10, { align: "right" });
  }

  const slug = `${meta.subject}-${meta.program}${meta.level ? "-" + meta.level : ""}-${meta.paper.split(" ·")[0]}`.replace(/\s+/g, "-");
  doc.save(`IBCommons-${slug}${markscheme ? "-markscheme" : ""}.pdf`);
}
