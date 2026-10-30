"use strict";

const $ = id => document.getElementById(id);
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- PDF.js worker (loaded as blob to avoid cross-origin worker errors) ---------- */
const workerReady = fetch(PDFJS + "pdf.worker.min.js")
  .then(r => r.text())
  .then(code => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  });

/* ---------- IndexedDB: "books" = metadata + cover, "files" = the PDF itself ---------- */
const dbp = new Promise((resolve, reject) => {
  const req = indexedDB.open("reading-room", 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore("books", { keyPath: "id", autoIncrement: true });
    req.result.createObjectStore("files");
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = async (name, mode = "readonly") => (await dbp).transaction(name, mode).objectStore(name);

/* ---------- UI helpers ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function busy(on, text = "") {
  $("busy").hidden = !on;
  $("busy-text").textContent = text;
}

/* ---------- Adding books ---------- */
async function makeCover(doc) {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: 360 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  return new Promise(res => canvas.toBlob(res, "image/jpeg", 0.82));
}

async function addFile(file) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    toast("Only PDF files can be added");
    return;
  }
  busy(true, `Adding ${file.name}`);
  try {
    await workerReady;
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const cover = await makeCover(doc);
    const meta = {
      name: file.name.replace(/\.pdf$/i, ""),
      pages: doc.numPages,
      page: 0,
      cover,
      size: file.size,
      added: Date.now()
    };
    const id = await p((await store("books", "readwrite")).add(meta));
    await p((await store("files", "readwrite")).put(file, id));
    doc.destroy();
    toast("Added to your shelf");
  } catch (e) {
    console.error(e);
    toast("This PDF could not be read. It may be damaged or password protected");
  }
  busy(false);
}

async function addFiles(list) {
  for (const f of list) await addFile(f);
  renderShelf();
}

$("file").addEventListener("change", e => {
  addFiles([...e.target.files]);
  e.target.value = "";
});

/* ---------- Drag and drop ---------- */
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
addEventListener("dragenter", e => { if (hasFiles(e)) { dragDepth++; $("drop").hidden = false; } });
addEventListener("dragleave", e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $("drop").hidden = true; } });
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", e => {
  e.preventDefault();
  dragDepth = 0;
  $("drop").hidden = true;
  if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
});

/* ---------- Shelf ---------- */
let firstRender = true;
let coverUrls = [];

async function renderShelf() {
  const books = (await p((await store("books")).getAll()))
    .sort((a, b) => (b.opened || b.added) - (a.opened || a.added));

  coverUrls.forEach(URL.revokeObjectURL);
  coverUrls = [];
  const shelf = $("shelf");
  shelf.innerHTML = "";

  if (!books.length) {
    shelf.innerHTML = `
      <div class="empty">
        <h2>Your shelf is empty</h2>
        <p>Drop a PDF anywhere on this page, or choose one from your device.</p>
        <label class="btn primary">Add PDF
          <input type="file" accept="application/pdf,.pdf" multiple hidden>
        </label>
      </div>`;
    shelf.querySelector("input").addEventListener("change", e => {
      addFiles([...e.target.files]);
      e.target.value = "";
    });
    return;
  }

  const w = parseFloat(getComputedStyle(shelf).getPropertyValue("--w")) || 150;
  const gap = innerWidth <= 560 ? 18 : 28;
  const inner = shelf.clientWidth - (innerWidth <= 560 ? 36 : 64);
  const perRow = Math.max(1, Math.floor((inner + gap) / (w + gap)));

  for (let i = 0; i < books.length; i += perRow) {
    const row = document.createElement("div");
    row.className = "row";
    books.slice(i, i + perRow).forEach((b, j) => {
      const url = URL.createObjectURL(b.cover);
      coverUrls.push(url);
      const pct = b.pages > 1 ? Math.round(((b.page || 0) / (b.pages - 1)) * 100) : 0;

      const item = document.createElement("div");
      item.className = "item";
      item.style.setProperty("--i", i + j);
      item.innerHTML = `
        <button class="book" type="button">
          <span class="cover">
            <img alt="">
            <span class="meta">
              <strong></strong>
              <span class="pg"></span>
              <span class="prog"><i style="width:${pct}%"></i></span>
            </span>
          </span>
        </button>
        <button class="del" type="button">✕</button>`;

      item.querySelector("img").src = url;
      item.querySelector("strong").textContent = b.name;
      item.querySelector(".pg").textContent = `Page ${(b.page || 0) + 1} of ${b.pages}`;
      item.querySelector(".book").setAttribute("aria-label", `Open ${b.name}`);
      item.querySelector(".del").setAttribute("aria-label", `Delete ${b.name}`);
      item.querySelector(".book").onclick = () => openBook(b.id);
      item.querySelector(".del").onclick = async () => {
        if (!confirm(`Delete "${b.name}" from this device?`)) return;
        await p((await store("books", "readwrite")).delete(b.id));
        await p((await store("files", "readwrite")).delete(b.id));
        toast("Book deleted");
        renderShelf();
      };
      row.appendChild(item);
    });
    shelf.appendChild(row);
  }

  shelf.classList.toggle("intro", firstRender);
  firstRender = false;
}

let resizeTimer;
addEventListener("resize", () => {
  if ($("reader").hidden) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderShelf, 200);
  }
});

/* ---------- Reader ---------- */
let flip = null, pdf = null, total = 0, meta = null, canvases = [];
const rendered = new Set();

async function openBook(id) {
  busy(true, "Opening book");
  try {
    await workerReady;
    meta = await p((await store("books")).get(id));
    const file = await p((await store("files")).get(id));
    pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    total = pdf.numPages;

    meta.opened = Date.now();
    await p((await store("books", "readwrite")).put(meta));

    const first = await pdf.getPage(1);
    const vp = first.getViewport({ scale: 1 });

    $("book-title").textContent = meta.name;
    $("book").innerHTML = "";
    const holder = document.createElement("div");
    holder.style.cssText = "width:100%;height:100%";
    $("book").appendChild(holder);

    rendered.clear();
    canvases = [];
    const pages = [];
    for (let i = 0; i < total; i++) {
      const d = document.createElement("div");
      d.className = "page loading";
      if (i === 0 || i === total - 1) d.dataset.density = "hard";
      const c = document.createElement("canvas");
      d.appendChild(c);
      canvases.push(c);
      pages.push(d);
    }

    const start = Math.min(meta.page || 0, total - 1);
    $("slider").max = total;
    $("slider").value = start + 1;

    $("library-view").hidden = true;
    $("reader").hidden = false;
    $("reader").classList.add("opening");
    setTimeout(() => $("reader").classList.remove("opening"), 1000);

    flip = new St.PageFlip(holder, {
      width: vp.width,
      height: vp.height,
      size: "stretch",
      minWidth: 250, maxWidth: 800,
      minHeight: 350, maxHeight: 1200,
      showCover: true,
      maxShadowOpacity: 0.55,
      flippingTime: reduceMotion ? 1 : 800,
      mobileScrollSupport: false,
      startPage: start
    });
    flip.loadFromHTML(pages);
    flip.on("flip", e => onPage(e.data));
    onPage(start);
  } catch (e) {
    console.error(e);
    toast("Could not open this book");
  }
  busy(false);
}

async function renderPage(i) {
  if (i < 0 || i >= total || rendered.has(i)) return;
  rendered.add(i);
  const page = await pdf.getPage(i + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(2.5, 1100 / base.width) });
  const canvas = canvases[i];
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  canvas.parentElement.classList.remove("loading");
}

let saveTimer;
function onPage(i) {
  for (let k = i - 2; k <= i + 3; k++) renderPage(k);
  $("label").textContent = `${i + 1} / ${total}`;
  $("slider").value = i + 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!meta) return;
    meta.page = i;
    await p((await store("books", "readwrite")).put(meta));
  }, 400);
}

async function closeBook() {
  clearTimeout(saveTimer);
  if (meta) {
    const i = flip ? flip.getCurrentPageIndex() : meta.page;
    meta.page = i;
    await p((await store("books", "readwrite")).put(meta));
  }
  if (document.fullscreenElement) document.exitFullscreen();
  if (flip) { try { flip.destroy(); } catch (e) {} flip = null; }
  if (pdf) { pdf.destroy(); pdf = null; }
  meta = null;
  $("reader").hidden = true;
  $("library-view").hidden = false;
  renderShelf();
}

$("back").onclick = closeBook;
$("prev").onclick = () => flip && flip.flipPrev();
$("next").onclick = () => flip && flip.flipNext();
$("slider").addEventListener("input", e => { $("label").textContent = `${e.target.value} / ${total}`; });
$("slider").addEventListener("change", e => flip && flip.turnToPage(+e.target.value - 1));
$("fs").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => toast("Fullscreen is not available"));
};
addEventListener("keydown", e => {
  if ($("reader").hidden || !flip) return;
  if (e.key === "ArrowRight") flip.flipNext();
  else if (e.key === "ArrowLeft") flip.flipPrev();
  else if (e.key === "Escape" && !document.fullscreenElement) closeBook();
});

/* ---------- Start ---------- */
addEventListener("DOMContentLoaded", renderShelf);
