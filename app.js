:root{
  --ink:#0e1a22;
  --ink-2:#14262f;
  --panel:#1b3340;
  --line:#2a4755;
  --wood:#5b3e2c;
  --wood-hi:#80593f;
  --amber:#f0b44c;
  --text:#e8eef0;
  --muted:#8fa5af;
  --ease:cubic-bezier(.2,.8,.2,1);
  --serif:"Newsreader",Georgia,"Times New Roman",serif;
  --sans:"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{
  margin:0;font-family:var(--sans);color:var(--text);
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%,#21424f 0%,transparent 70%),
    var(--ink);
  -webkit-font-smoothing:antialiased;
}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--amber);outline-offset:3px}

/* ---------- Buttons ---------- */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:10px 18px;border-radius:999px;border:1px solid var(--line);
  background:var(--ink-2);cursor:pointer;font-size:14px;font-weight:500;
  transition:background .2s,transform .2s var(--ease),border-color .2s;
}
.btn:hover{background:var(--panel);border-color:#3b6173}
.btn:active{transform:scale(.97)}
.btn.primary{background:var(--amber);color:#2a1d06;border-color:var(--amber);font-weight:600}
.btn.primary:hover{background:#f6c36d}
.icon-btn{
  width:44px;height:44px;border-radius:50%;border:1px solid var(--line);
  background:var(--ink-2);cursor:pointer;font-size:22px;line-height:1;
  display:grid;place-items:center;transition:background .2s,transform .2s var(--ease);
}
.icon-btn:hover{background:var(--panel)}
.icon-btn:active{transform:scale(.92)}

/* ---------- Library ---------- */
#library-view{max-width:1100px;margin:0 auto;padding:40px 24px 80px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:56px}
.top h1{font-family:var(--serif);font-weight:600;font-size:clamp(34px,6vw,52px);letter-spacing:-.02em;margin:0 0 6px}
.top p{margin:0;color:var(--muted);font-size:15px}

#shelf{--w:150px}
.row{
  position:relative;display:flex;align-items:flex-end;gap:28px;
  padding:0 32px;margin-bottom:64px;min-height:130px;
}
.row::after{
  content:"";position:absolute;left:0;right:0;bottom:-20px;height:20px;
  background:linear-gradient(var(--wood-hi) 0 3px,var(--wood) 3px);
  border-radius:3px;box-shadow:0 16px 26px rgba(0,0,0,.5);
}
.item{position:relative;width:var(--w);transform-origin:bottom center;transition:transform .35s var(--ease)}
.item:hover,.item:focus-within{transform:translateY(-12px) rotate(-1.5deg)}
.book{display:block;width:100%;padding:0;border:0;background:none;cursor:pointer;text-align:left}
.cover{position:relative;display:block;border-radius:2px 6px 6px 2px;overflow:hidden;box-shadow:0 10px 22px rgba(0,0,0,.55)}
.cover img{display:block;width:100%;height:auto;background:#fbfaf6}
.cover::before{
  content:"";position:absolute;inset:0 auto 0 0;width:12px;z-index:1;
  background:linear-gradient(90deg,rgba(0,0,0,.4),rgba(255,255,255,.12) 60%,transparent);
}
.meta{
  position:absolute;left:0;right:0;bottom:0;padding:34px 10px 9px 16px;
  background:linear-gradient(transparent,rgba(8,14,18,.92));
  display:flex;flex-direction:column;gap:3px;
}
.meta strong{
  font-family:var(--serif);font-weight:600;font-size:14px;line-height:1.2;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.pg{font-size:11px;color:#c3d1d7}
.prog{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.2);margin-top:4px;overflow:hidden}
.prog i{display:block;height:100%;background:var(--amber)}
.del{
  position:absolute;top:6px;right:6px;z-index:2;width:28px;height:28px;border-radius:50%;
  border:0;background:rgba(8,14,18,.8);cursor:pointer;font-size:13px;
  opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s var(--ease),background .2s;
}
.item:hover .del,.item:focus-within .del{opacity:1;transform:none}
.del:hover{background:#b3392d}
@media (hover:none){.del{opacity:1;transform:none}}

.intro .item{animation:rise .8s var(--ease) backwards;animation-delay:calc(var(--i)*70ms)}
@keyframes rise{from{opacity:0;transform:translateY(40px) rotate(2deg)}}

.empty{
  text-align:center;padding:70px 20px 40px;position:relative;margin-bottom:20px;
}
.empty::after{
  content:"";position:absolute;left:0;right:0;bottom:-20px;height:20px;
  background:linear-gradient(var(--wood-hi) 0 3px,var(--wood) 3px);border-radius:3px;
  box-shadow:0 16px 26px rgba(0,0,0,.5);
}
.empty h2{font-family:var(--serif);font-weight:500;font-size:26px;margin:0 0 8px}
.empty p{color:var(--muted);margin:0 0 22px}

/* ---------- Reader ---------- */
#reader{
  position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;
  background:radial-gradient(ellipse 70% 60% at 50% 38%,#25495a 0%,var(--ink) 70%);
}
.reader-top{display:flex;align-items:center;gap:14px;padding:12px 18px}
.reader-top h2{
  flex:1;margin:0;text-align:center;font-family:var(--serif);font-weight:500;font-size:18px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.stage{flex:1;min-height:0;display:grid;place-items:center;padding:6px 24px;perspective:1800px}
#book{width:min(1150px,100%);height:100%}
#reader.opening .stage{animation:lift .9s var(--ease)}
@keyframes lift{from{opacity:0;transform:translateY(40px) scale(.9) rotateX(10deg)}}

.page{background:#fbfaf6;overflow:hidden;position:relative}
.page canvas{display:block;width:100%;height:100%}
.page.loading::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(100deg,transparent 30%,rgba(0,0,0,.06) 50%,transparent 70%) 0 0/200% 100%;
  animation:shimmer 1.2s linear infinite;
}
@keyframes shimmer{to{background-position:-200% 0}}

.reader-bar{
  display:flex;align-items:center;gap:16px;justify-content:center;
  padding:10px 18px 18px;max-width:760px;width:100%;margin:0 auto;
}
#slider{flex:1;accent-color:var(--amber);height:24px;cursor:pointer}
#label{min-width:88px;text-align:center;font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}

/* ---------- Overlays ---------- */
#drop,#busy{
  position:fixed;inset:0;z-index:30;display:grid;place-items:center;text-align:center;
  background:rgba(10,18,24,.82);backdrop-filter:blur(6px);
  font-family:var(--serif);font-size:26px;
}
#drop{border:2px dashed var(--amber);margin:14px;inset:0;border-radius:18px;background:rgba(10,18,24,.9)}
#busy{flex-direction:column;gap:16px;font-family:var(--sans);font-size:15px;color:var(--muted)}
#busy:not([hidden]){display:flex;align-items:center;justify-content:center}
.spinner{width:34px;height:34px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--amber);animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

#toast{
  position:fixed;left:50%;bottom:28px;z-index:40;transform:translate(-50%,30px);opacity:0;
  background:var(--panel);border:1px solid var(--line);padding:11px 18px;border-radius:999px;
  font-size:14px;pointer-events:none;transition:opacity .25s,transform .35s var(--ease);
}
#toast.show{opacity:1;transform:translate(-50%,0)}

@media (max-width:560px){
  #shelf{--w:118px}
  .row{gap:18px;padding:0 18px}
  .stage{padding:6px 8px}
  .reader-top h2{font-size:16px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}

/* ======================================================
   Responsive reader, settings panel, tones
   ====================================================== */
html,body{overscroll-behavior:none}
#reader{
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  overflow:hidden;
}
.stage{overflow:hidden}
#book{width:min(1700px,100%);height:100%;touch-action:pan-y}
.reader-top .btn{white-space:nowrap}
.reader-top,.reader-bar{transition:opacity .35s,transform .35s var(--ease)}
#reader.ui-hidden .reader-top{opacity:0;transform:translateY(-100%);pointer-events:none}
#reader.ui-hidden .reader-bar{opacity:0;transform:translateY(100%);pointer-events:none}
.icon-btn.small{width:34px;height:34px;font-size:15px}

/* page tones */
#book[data-tone="sepia"] .page{background:#f1e4c8}
#book[data-tone="sepia"] .page canvas{filter:sepia(.55) contrast(.95) brightness(.97)}
#book[data-tone="night"] .page{background:#16181b}
#book[data-tone="night"] .page canvas{filter:invert(.92) hue-rotate(180deg) contrast(.92) brightness(.95)}

/* settings panel */
#settings{
  position:absolute;z-index:20;top:62px;right:14px;
  width:min(360px,calc(100vw - 28px));max-height:calc(100dvh - 90px);overflow:auto;
  background:var(--ink-2);border:1px solid var(--line);border-radius:16px;padding:18px;
  box-shadow:0 24px 60px rgba(0,0,0,.55);
}
#settings:not([hidden]){animation:pop .28s var(--ease)}
@keyframes pop{from{opacity:0;transform:translateY(-10px) scale(.97)}}
.set-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-family:var(--serif);font-size:19px}
.set-row{display:grid;gap:8px;margin-bottom:16px}
.set-row:last-child{margin-bottom:0}
.set-label{font-size:13px;font-weight:600}
.set-row small{color:var(--muted);font-size:12px;line-height:1.4}
.seg{display:flex;gap:3px;padding:3px;background:var(--ink);border:1px solid var(--line);border-radius:11px}
.seg button{
  flex:1;border:0;background:none;border-radius:8px;padding:9px 6px;min-height:38px;
  font-size:13px;color:var(--muted);cursor:pointer;transition:background .2s,color .2s;
}
.seg button:hover{color:var(--text)}
.seg button[aria-pressed="true"]{background:var(--amber);color:#2a1d06;font-weight:600}
#volume{width:100%;accent-color:var(--amber);height:24px}
#volume:disabled{opacity:.4}

/* phones: settings become a bottom sheet */
@media (max-width:560px){
  #settings{
    top:auto;bottom:0;left:0;right:0;width:auto;max-height:78dvh;
    border-radius:20px 20px 0 0;border-bottom:0;
    padding-bottom:calc(18px + env(safe-area-inset-bottom));
  }
  #settings:not([hidden]){animation:sheet .32s var(--ease)}
  .reader-top{gap:8px;padding:8px 10px}
  .reader-top .btn{padding:9px 12px;font-size:13px}
  .reader-top h2{display:none}
  .reader-top .btn#back{margin-right:auto}
  .reader-bar{gap:10px;padding:6px 12px 12px}
  #label{min-width:70px;font-size:13px}
}
@keyframes sheet{from{transform:translateY(100%)}}

/* short screens (phones in landscape, small windows) */
@media (max-height:520px){
  .reader-top{padding:5px 12px}
  .reader-top h2{display:none}
  .reader-top .btn#back{margin-right:auto}
  .reader-top .btn{padding:6px 12px;font-size:13px}
  .stage{padding:2px 8px}
  .reader-bar{padding:3px 12px 6px;gap:10px}
  .icon-btn{width:34px;height:34px;font-size:18px}
  #settings{top:48px;max-height:calc(100dvh - 58px);width:min(340px,calc(100vw - 28px))}
}
@media (max-height:520px) and (max-width:900px){
  #settings{left:auto;right:10px;bottom:auto;border-radius:16px;border-bottom:1px solid var(--line);padding-bottom:14px}
  #settings:not([hidden]){animation:pop .28s var(--ease)}
}
