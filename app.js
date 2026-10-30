"use strict";

const $ = id => document.getElementById(id);
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPEEDS = { slow: 1300, normal: 800, fast: 450 };

/* ======================================================
   Settings (saved on this device)
   ====================================================== */
const DEFAULTS = { view: "auto", cover: "on", sound: "on", volume: 0.6, speed: "normal", tone: "paper", hide: "off" };
const SETTINGS_KEY = "reading-room-settings";
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} };

/* ======================================================
   PDF.js worker (loaded as a blob to avoid cross-origin worker errors)
   ====================================================== */
const workerReady = fetch(PDFJS + "pdf.worker.min.js")
  .then(r => r.text())
  .then(code => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  });

/* ======================================================
   IndexedDB: "books" = metadata + cover, "files" = the PDF itself
   ====================================================== */
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

/* ======================================================
   UI helpers
   ====================================================== */
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

/* ======================================================
   Page turn sound (synthesized, no audio file needed)
   ====================================================== */
let actx = null, noiseBuf = null, lastSound = 0;

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!actx) {
    actx = new AC();
    const len = actx.sampleRate;
    noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

function playFlip(force = false) {
  if (settings.sound !== "on") return;
  const nowMs = performance.now();
  if (!force && nowMs - lastSound < 140) return;
  lastSound = nowMs;
  const ctx = audio();
  if (!ctx) return;

  const v = x => Math.max(0.0002, x);
  const vol = +settings.volume;
  const t = ctx.currentTime;
  const dur = Math.max(0.28, Math.min(0.6, SPEEDS[settings.speed] / 1000 * 0.55));

  // paper rustle: filtered noise sweeping upward
  const rustle = ctx.createBufferSource();
  rustle.buffer = noiseBuf;
  rustle.playbackRate.value = 0.85 + Math.random() * 0.3;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v(vol * 0.8), t + dur * 0.2);
  g.gain.exponentialRampToValueAtTime(v(vol * 0.25), t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  rustle.connect(bp).connect(g).connect(ctx.destination);
  rustle.start(t, Math.random() * 0.3);
  rustle.stop(t + dur + 0.05);

  // soft landing tap when the page settles
  const tap = ctx.createBufferSource();
  tap.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 600;
  const tg = ctx.createGain();
  const at = t + dur * 0.88;
  tg.gain.setValueAtTime(0.0001, at);
  tg.gain.linearRampToValueAtTime(v(vol * 0.45), at + 0.012);
  tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
  tap.connect(lp).connect(tg).connect(ctx.destination);
  tap.start(at, Math.random() * 0.5);
  tap.stop(at + 0.14);
}

// browsers only allow audio after a user gesture
addEventListener("pointerdown", () => { if (settings.sound === "on") audio(); }, { passive: true });

/* ======================================================
   Adding books
   ====================================================== */
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
    toast("Could not add this PDF: " + (e && e.message ? e.message : e));
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

/* ======================================================
   Shelf
   ====================================================== */
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
  const small = innerWidth <= 560;
  const gap = small ? 18 : 28;
  const inner = shelf.clientWidth - (small ? 36 : 64);
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

let shelfTimer;
addEventListener("resize", () => {
  if ($("reader").hidden) {
    clearTimeout(shelfTimer);
    shelfTimer = setTimeout(renderShelf, 200);
  }
});

/* ======================================================
   Reader
   ====================================================== */
let flip = null, pdf = null, total = 0, meta = null;
let canvases = [], pageW = 1, pageH = 1, pageRatio = 0.7;
const started = new Set();   // pages whose render has started
const ready = new Set();     // pages fully drawn

// One page on tall screens, two on wide ones (or whatever the person chose)
function desiredMode() {
  if (settings.view !== "auto") return settings.view;
  const host = $("book");
  const ratio = host.clientWidth / Math.max(1, host.clientHeight);
  return ratio >= pageRatio * 2 * 0.72 ? "double" : "single";
}

function makePages() {
  const hardEnds = settings.cover === "on";
  return canvases.map((c, i) => {
    const d = document.createElement("div");
    d.className = "page" + (ready.has(i) ? "" : " loading");
    if (hardEnds && (i === 0 || i === total - 1)) d.dataset.density = "hard";
    d.appendChild(c);
    return d;
  });
}

function destroyFlip() {
  if (!flip) return;
  try {
    // the library never stops its animation loop, so silence it before removing
    const r = flip.getRender();
    r.render = () => {};
    r.drawFrame = () => {};
    flip.destroy();
  } catch (e) {}
  flip = null;
}

function buildFlip(start) {
  destroyFlip();
  const host = $("book");
  host.innerHTML = "";
  const holder = document.createElement("div");
  holder.style.cssText = "width:100%;height:100%";
  host.appendChild(holder);

  const single = desiredMode() === "single";
  flip = new St.PageFlip(holder, {
    width: pageW,
    height: pageH,
    size: "stretch",
    autoSize: false,
    usePortrait: single,
    minWidth: single ? 100000 : 150,   // large value forces the one-page layout
    maxWidth: 2000,
    minHeight: 150,
    maxHeight: 3000,
    showCover: settings.cover === "on",
    maxShadowOpacity: 0.55,
    flippingTime: reduceMotion ? 1 : SPEEDS[settings.speed],
    mobileScrollSupport: false,
    startPage: Math.max(0, Math.min(start, total - 1))
  });
  flip.loadFromHTML(makePages());
  holder.style.minWidth = "0";   // must come after loadFromHTML, which sets its own min-width

  let dragSound = false;
  flip.on("flip", e => onPage(e.data));
  flip.on("changeState", e => {
    if (e.data === "flipping") playFlip();
    else if (e.data === "user_fold" && !dragSound) { dragSound = true; playFlip(); }
    else if (e.data === "read") dragSound = false;
  });
  onPage(flip.getCurrentPageIndex());
}

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
    pageW = vp.width;
    pageH = vp.height;
    pageRatio = pageW / pageH;

    started.clear();
    ready.clear();
    canvases = Array.from({ length: total }, () => document.createElement("canvas"));

    const start = Math.min(meta.page || 0, total - 1);
    $("book-title").textContent = meta.name;
    $("book").dataset.tone = settings.tone;
    $("slider").max = total;
    $("slider").value = start + 1;

    $("library-view").hidden = true;
    $("reader").hidden = false;
    $("reader").classList.add("opening");
    setTimeout(() => $("reader").classList.remove("opening"), 1000);

    syncSettingsUI();
    buildFlip(start);
    poke();
  } catch (e) {
    console.error(e);
    toast("Could not open this book: " + (e && e.message ? e.message : e));
  }
  busy(false);
}

async function renderPage(i) {
  if (i < 0 || i >= total || started.has(i)) return;
  started.add(i);
  const doc = pdf;
  const page = await doc.getPage(i + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(2.5, 1100 / base.width) });
  const canvas = canvases[i];
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  if (doc !== pdf) return;
  ready.add(i);
  if (canvas.parentElement) canvas.parentElement.classList.remove("loading");
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
  clearTimeout(idleTimer);
  closeSettings();
  if (meta) {
    meta.page = flip ? flip.getCurrentPageIndex() : meta.page;
    await p((await store("books", "readwrite")).put(meta));
  }
  if (fsActive()) exitFs();
  destroyFlip();
  if (pdf) { pdf.destroy(); pdf = null; }
  meta = null;
  $("reader").hidden = true;
  $("library-view").hidden = false;
  renderShelf();
}

/* ---------- Re-layout when the screen changes (rotate, resize, fullscreen) ---------- */
let layoutTimer;
new ResizeObserver(() => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    if (!flip || $("reader").hidden) return;
    const want = desiredMode();
    const have = flip.getOrientation() === "portrait" ? "single" : "double";
    if (want !== have) buildFlip(flip.getCurrentPageIndex());
  }, 150);
}).observe($("book"));

/* ---------- Controls ---------- */
const goTo = i => {
  if (!flip) return;
  i = Math.max(0, Math.min(total - 1, i));
  if (i === flip.getCurrentPageIndex()) return;
  playFlip();
  flip.turnToPage(i);
};

$("back").onclick = closeBook;
$("prev").onclick = () => flip && flip.flipPrev();
$("next").onclick = () => flip && flip.flipNext();
$("slider").addEventListener("input", e => { $("label").textContent = `${e.target.value} / ${total}`; });
$("slider").addEventListener("change", e => goTo(+e.target.value - 1));

addEventListener("keydown", e => {
  if ($("reader").hidden || !flip) return;
  if (e.target.matches("input[type=range]")) return;
  switch (e.key) {
    case "ArrowRight": case "PageDown": flip.flipNext(); break;
    case "ArrowLeft": case "PageUp": flip.flipPrev(); break;
    case "Home": goTo(0); break;
    case "End": goTo(total - 1); break;
    case "Escape":
      if (!$("settings").hidden) closeSettings();
      else if (!fsActive()) closeBook();
      break;
  }
});

/* ---------- Fullscreen (with Safari prefixes; hidden where unsupported, e.g. iPhone) ---------- */
const fsRoot = document.documentElement;
const fsActive = () => document.fullscreenElement || document.webkitFullscreenElement;
const exitFs = () => Promise.resolve((document.exitFullscreen || document.webkitExitFullscreen).call(document)).catch(() => {});
const enterFs = () => Promise.resolve((fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot))
  .catch(() => toast("Fullscreen is not available in this browser"));
if (!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen)) $("fs").hidden = true;
$("fs").onclick = () => (fsActive() ? exitFs() : enterFs());
const fsLabel = () => { $("fs").textContent = fsActive() ? "Exit fullscreen" : "Fullscreen"; };
document.addEventListener("fullscreenchange", fsLabel);
document.addEventListener("webkitfullscreenchange", fsLabel);

/* ---------- Auto-hide controls ---------- */
let idleTimer;
function poke() {
  const r = $("reader");
  r.classList.remove("ui-hidden");
  clearTimeout(idleTimer);
  if (settings.hide === "on" && $("settings").hidden) {
    idleTimer = setTimeout(() => r.classList.add("ui-hidden"), 2800);
  }
}
["pointermove", "pointerdown", "keydown", "touchstart"].forEach(ev =>
  addEventListener(ev, () => { if (!$("reader").hidden) poke(); }, { passive: true })
);

/* ---------- Settings panel ---------- */
function syncSettingsUI() {
  document.querySelectorAll(".seg").forEach(group => {
    group.querySelectorAll("button").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.v === String(settings[group.dataset.key])))
    );
  });
  $("volume").value = settings.volume;
  $("volume").disabled = settings.sound === "off";
}

function openSettings() {
  $("settings").hidden = false;
  $("settingsBtn").setAttribute("aria-expanded", "true");
  $("reader").classList.remove("ui-hidden");
  clearTimeout(idleTimer);
}
function closeSettings() {
  $("settings").hidden = true;
  $("settingsBtn").setAttribute("aria-expanded", "false");
  poke();
}

function applySetting(key, val) {
  settings[key] = val;
  saveSettings();
  syncSettingsUI();
  if (key === "tone") $("book").dataset.tone = val;
  if (key === "hide") poke();
  if (key === "sound" && val === "on") playFlip(true);
  if (["view", "cover", "speed"].includes(key) && flip) buildFlip(flip.getCurrentPageIndex());
}

document.querySelectorAll(".seg").forEach(group =>
  group.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) applySetting(group.dataset.key, b.dataset.v);
  })
);
$("volume").addEventListener("input", e => { settings.volume = +e.target.value; saveSettings(); });
$("volume").addEventListener("change", () => playFlip(true));
$("settingsBtn").onclick = () => ($("settings").hidden ? openSettings() : closeSettings());
$("settingsClose").onclick = closeSettings;
document.addEventListener("pointerdown", e => {
  if ($("settings").hidden) return;
  if (!$("settings").contains(e.target) && !$("settingsBtn").contains(e.target)) closeSettings();
});

/* ---------- Start ---------- */
syncSettingsUI();
addEventListener("DOMContentLoaded", renderShelf);
