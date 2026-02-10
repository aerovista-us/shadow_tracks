/* Shadow Album Player — app.js (no external deps) */
// Keep these paths in sync with files in /audio and optional SW precache entries.
const tracks = [
  { id: "bad_habits",  title: "Bad Habits",              vibe: "shadow cut · bad week energy", file: "audio/sample.wav" },
  { id: "sick_plus",   title: "Sick +",                  vibe: "disgustin' positive",         file: "audio/sample.wav" },
  { id: "receipts",    title: "Receipts & Rebounds",     vibe: "accountability bounce",       file: "audio/sample.wav" },
  { id: "saint_sinner",title: "Saint, Then Sinner",      vibe: "switch-flip anthem",          file: "audio/sample.wav" },
  { id: "dnd_okay",    title: "Don’t Ask Me If I’m Okay",vibe: "sarcasm healing",             file: "audio/sample.wav" },
  { id: "new_rules",   title: "New Rules, Same Monster", vibe: "discipline vs relapse",       file: "audio/sample.wav" },
  { id: "dnd",         title: "Do Not Disturb",          vibe: "temptation test",             file: "audio/sample.wav" },
];

const state = {
  index: 0,
  isPlaying: false,
  shuffle: false,
  loop: false,
  audioCtx: null,
  analyser: null,
  source: null,
  raf: null
};

const $ = (sel) => document.querySelector(sel);

const audio = $("#audio");
const playBtn = $("#playBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const shuffleBtn = $("#shuffleBtn");
const loopBtn = $("#loopBtn");
const seek = $("#seek");
const curTimeEl = $("#curTime");
const durTimeEl = $("#durTime");
const titleEl = $("#nowTitle");
const metaEl = $("#nowMeta");
const taglineEl = $("#tagline");
const listEl = $("#list");
const viz = $("#viz");
const installBtn = $("#installBtn");
const hasMediaSession = "mediaSession" in navigator;
const hasMediaMetadata = "MediaMetadata" in window;

function fmtTime(s){
  if(!isFinite(s)) return "0:00";
  s = Math.max(0, s|0);
  const m = (s/60)|0;
  const r = s%60;
  return `${m}:${String(r).padStart(2,"0")}`;
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.classList.remove("show"), 1600);
}

function current(){
  return tracks[state.index];
}

function setActiveItem(){
  [...listEl.children].forEach((el, i) => {
    el.classList.toggle("active", i === state.index);
  });
}

function stopVisualizerLoop(){
  if(state.raf !== null){
    cancelAnimationFrame(state.raf);
    state.raf = null;
  }
}

function startVisualizerLoop(){
  if(!state.analyser || !state.isPlaying || state.raf !== null) return;
  drawViz();
}

function setupMediaSessionHandlers(){
  if(!hasMediaSession) return;
  const handlers = {
    play,
    pause,
    previoustrack: prev,
    nexttrack: next
  };
  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      // Ignore unsupported action handlers.
    }
  });
}

function updateMediaSessionMetadata(){
  if(!hasMediaSession || !hasMediaMetadata) return;
  const tr = current();
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tr.title,
      artist: "Shadow Album Player",
      album: "Shadow Album"
    });
  } catch (e) {
    // Ignore MediaMetadata assignment failures on partial implementations.
  }
}

function updateMediaSessionPlaybackState(){
  if(!hasMediaSession) return;
  try {
    navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
  } catch (e) {
    // Ignore playbackState assignment failures.
  }
}

function loadTrack(i, autoplay=false){
  state.isPlaying = false;
  stopVisualizerLoop();
  state.index = (i + tracks.length) % tracks.length;
  const tr = current();

  seek.disabled = true;
  seek._dragging = false;
  seek.value = "0";
  seek.max = "0";
  curTimeEl.textContent = "0:00";
  durTimeEl.textContent = "0:00";

  audio.src = tr.file;
  audio.load();
  audio.loop = state.loop;

  titleEl.textContent = tr.title;
  metaEl.textContent = `Track ${state.index + 1} • 148 BPM • ${tr.vibe}`;
  taglineEl.textContent = state.shuffle ? "shuffle on" : (state.loop ? "loop on" : "shadow album mode");
  updateMediaSessionMetadata();
  updateMediaSessionPlaybackState();

  setActiveItem();
  if (autoplay) play();
  else pause();
}

function play(){
  audio.play().then(() => {
    state.isPlaying = true;
    playBtn.setAttribute("aria-label","Pause");
    playBtn.innerHTML = icon("pause");
    updateMediaSessionPlaybackState();
    setupVisualizer().then(() => startVisualizerLoop());
  }).catch(() => {
    pause();
    toast("Tap play again (browser blocked autoplay).");
  });
}

function pause(){
  audio.pause();
  state.isPlaying = false;
  stopVisualizerLoop();
  playBtn.setAttribute("aria-label","Play");
  playBtn.innerHTML = icon("play");
  updateMediaSessionPlaybackState();
}

function next(){
  if(state.shuffle){
    const n = Math.floor(Math.random()*tracks.length);
    loadTrack(n, true);
  } else {
    loadTrack(state.index + 1, true);
  }
}

function prev(){
  if(audio.currentTime > 2.5){
    audio.currentTime = 0;
    return;
  }
  loadTrack(state.index - 1, true);
}

function toggleShuffle(){
  state.shuffle = !state.shuffle;
  shuffleBtn.setAttribute("aria-pressed", String(state.shuffle));
  taglineEl.textContent = state.shuffle ? "shuffle on" : (state.loop ? "loop on" : "shadow album mode");
  toast(state.shuffle ? "Shuffle: ON" : "Shuffle: OFF");
}

function toggleLoop(){
  state.loop = !state.loop;
  audio.loop = state.loop;
  loopBtn.setAttribute("aria-pressed", String(state.loop));
  taglineEl.textContent = state.loop ? "loop on" : (state.shuffle ? "shuffle on" : "shadow album mode");
  toast(state.loop ? "Loop: ON" : "Loop: OFF");
}

audio.addEventListener("loadedmetadata", () => {
  seek.value = 0;
  seek.max = String(Math.floor(audio.duration || 0));
  seek.disabled = false;
  durTimeEl.textContent = fmtTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  if(!seek._dragging) seek.value = String(Math.floor(audio.currentTime || 0));
  curTimeEl.textContent = fmtTime(audio.currentTime);
});

seek.addEventListener("input", () => {
  if(seek.disabled) return;
  seek._dragging = true;
  curTimeEl.textContent = fmtTime(Number(seek.value));
});
seek.addEventListener("change", () => {
  if(seek.disabled) return;
  audio.currentTime = Number(seek.value);
  seek._dragging = false;
});

audio.addEventListener("error", () => {
  const code = audio.error ? audio.error.code : 0;
  const reason = {
    1: "aborted",
    2: "network error",
    3: "decode error",
    4: "unsupported source"
  }[code] || "unknown error";
  pause();
  toast(`Track couldn't load (${reason}).`);
});

audio.addEventListener("ended", () => {
  if(!state.loop) next();
});

playBtn.addEventListener("click", () => state.isPlaying ? pause() : play());
prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);
shuffleBtn.addEventListener("click", toggleShuffle);
loopBtn.addEventListener("click", toggleLoop);

// Keyboard shortcuts (desktop)
window.addEventListener("keydown", (e) => {
  if(e.target && ["INPUT","TEXTAREA"].includes(e.target.tagName)) return;
  if(e.code === "Space"){ e.preventDefault(); state.isPlaying ? pause() : play(); }
  if(e.code === "ArrowRight") next();
  if(e.code === "ArrowLeft") prev();
  if(e.code === "KeyS") toggleShuffle();
  if(e.code === "KeyL") toggleLoop();
});

// Build playlist UI
function renderList(){
  listEl.innerHTML = "";
  tracks.forEach((t, i) => {
    const el = document.createElement("div");
    el.className = "item";
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="bullet"></div>
      <div>
        <div class="ititle">${t.title}</div>
        <div class="isub">${t.vibe}</div>
      </div>
    `;
    el.addEventListener("click", () => loadTrack(i, true));
    el.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); loadTrack(i, true); }
    });
    listEl.appendChild(el);
  });
}

function icon(name){
  if(name === "play") return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 7v10l9-5-9-5Z" fill="currentColor"/></svg>`;
  if(name === "pause") return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 6h3v12H7zM14 6h3v12h-3z" fill="currentColor"/></svg>`;
  if(name === "prev") return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 6h2v12H7zM10 12l11 6V6l-11 6Z" fill="currentColor"/></svg>`;
  if(name === "next") return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 12 4 6v12l11-6Z" fill="currentColor"/><path d="M17 6h2v12h-2z" fill="currentColor"/></svg>`;
  if(name === "shuffle") return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 3h5v5h-2V6.41l-3.59 3.59-1.41-1.41L17.59 5H16V3ZM4 4h2.5l5.1 5.1-1.4 1.4L5.67 6H4V4Zm16.59 14L19 16.41V18h-1.59l-3.59-3.59 1.41-1.41L19 15.59V14h2v5h-5v-2h2.59ZM4 18v-2h1.67l4.53-4.53 1.4 1.4L6.5 18H4Zm8.3-6.7 1.4-1.4 1 1-1.4 1.4-1-1Z" fill="currentColor"/></svg>`;
  if(name === "loop") return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 7h11v4l4-5-4-5v4H6a4 4 0 0 0-4 4v3h2V9a2 2 0 0 1 2-2Zm10 10H6v-4l-4 5 4 5v-4h12a4 4 0 0 0 4-4v-3h-2v3a2 2 0 0 1-2 2Z" fill="currentColor"/></svg>`;
  return "";
}

// Visualizer (WebAudio)
async function setupVisualizer(){
  try {
    if(!state.audioCtx){
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      const src = ctx.createMediaElementSource(audio);
      src.connect(analyser);
      analyser.connect(ctx.destination);

      state.audioCtx = ctx;
      state.analyser = analyser;
      state.source = src;
    }

    if(state.audioCtx.state === "suspended"){
      await state.audioCtx.resume();
    }
  } catch (e) {
    // Some browsers block this until user gesture; ignore.
  }
}

function drawViz(){
  const c = viz;
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);
  const g = c.getContext("2d");

  const buf = new Uint8Array(state.analyser ? state.analyser.frequencyBinCount : 0);

  const loop = () => {
    g.clearRect(0,0,c.width,c.height);

    // background glow
    g.globalAlpha = 0.8;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0,0,c.width,c.height);

    if(!state.analyser) return;

    state.analyser.getByteFrequencyData(buf);

    const bars = 44;
    const step = Math.max(1, Math.floor(buf.length / bars));
    const w = c.width / bars;

    for(let i=0;i<bars;i++){
      const v = buf[i*step] / 255;
      const h = (c.height * 0.86) * v;
      const x = i*w;
      const y = c.height - h;

      // no fixed colors requested; use subtle lightness only (still neon vibe via CSS)
      g.globalAlpha = 0.9;
      g.fillStyle = `rgba(233,236,255,${0.18 + v*0.65})`;
      roundRect(g, x+2*dpr, y, w-4*dpr, h, 10*dpr);
      g.fill();
    }

    if(!state.isPlaying){
      state.raf = null;
      return;
    }
    state.raf = requestAnimationFrame(loop);
  };
  loop();
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

// PWA install prompt
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  toast(outcome === "accepted" ? "Installed. Shadow mode ready." : "Install dismissed.");
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Register SW
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Boot
renderList();
setupMediaSessionHandlers();
loadTrack(0, false);
playBtn.innerHTML = icon("play");
prevBtn.innerHTML = icon("prev");
nextBtn.innerHTML = icon("next");
shuffleBtn.innerHTML = icon("shuffle");
loopBtn.innerHTML = icon("loop");
seek.disabled = true;
