/* ==================================================================
   chat-widget.js  ·  แชตบอตสำหรับ Aura Beauty (ดีไซน์ใหม่)
   ================================================================== */

(function(){
  const s = document.createElement("script");
  s.src = "config.js?t=" + Date.now();
  s.onerror = () => console.error("ไม่พบไฟล์ config.js");
  s.onload = () => window.__startApp && window.__startApp();
  document.head.appendChild(s);
})();

const PROVIDERS = {
  worker: {
    name: "Worker",
    url: null,
    auth: () => ({}),
    style: "openai",
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    auth: (k) => ({ "Authorization": "Bearer " + k }),
    style: "openai",
  },
  gemini: {
    name: "Google Gemini",
    url: null,
    auth: (k) => ({ "x-goog-api-key": k }),
    style: "gemini",
  },
};

let CFG = {}, CHUNKS = [], INDEX = [];
let READY = false;
let onReady = () => {};

function workerURL(path){
  const base = (CFG.WORKER_URL || "").replace(/\/+$/, "");
  if (!base) throw new Error("ยังไม่ได้ใส่ WORKER_URL ใน config.js");
  return base + path;
}
let VEC = null;
let MODE = "local";
let FELL_BACK = false;
const $ = (id) => document.getElementById(id);
let onStatus = () => {};
const boot = (t) => onStatus(t);

async function buildChunks(){
  const out = [];
  const base = (CFG.DOCS_BASE || "").replace(/\/+$/, "");
  for (const f of CFG.FILES) {
    const url = base ? `${base}/${f}` : f;
    let text;
    try {
      const r = await fetch(url + "?t=" + Date.now());
      if (!r.ok) throw new Error(r.status);
      text = (await r.text()).trim();
    } catch {
      throw new Error(`อ่านไฟล์ ${url} ไม่ได้`);
    }
    let start = 0, part = 1;
    while (start < text.length) {
      out.push({ source: f, part, text: text.slice(start, start + (CFG.CHUNK_SIZE || 500)) });
      start += (CFG.CHUNK_SIZE || 500) - (CFG.OVERLAP || 100);
      part++;
    }
  }
  return out;
}

function grams(s, n = 3){
  const t = s.replace(/\s+/g, "");
  const m = new Map();
  for (let i = 0; i + n <= t.length; i++) {
    const g = t.slice(i, i + n);
    m.set(g, (m.get(g) || 0) + 1);
  }
  let sum = 0;
  for (const v of m.values()) sum += v * v;
  return { m, norm: Math.sqrt(sum) || 1 };
}

function similarity(a, b){
  let num = 0;
  const [small, big] = a.m.size < b.m.size ? [a, b] : [b, a];
  for (const [g, v] of small.m) {
    const w = big.m.get(g);
    if (w) num += v * w;
  }
  return num / (a.norm * b.norm);
}

function search(question){
  const q = grams(question);
  return INDEX
    .map((g, i) => ({ i, score: similarity(g, q) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.TOP_K || 3)
    .map(({ i, score }) => ({ ...CHUNKS[i], score: Math.round(score * 1000) / 1000 }));
}

async function loadVectors(){
  const r = await fetch((CFG.VECTORS_FILE || "vectors.json") + "?t=" + Date.now());
  if (!r.ok) throw new Error(`อ่านไฟล์เวกเตอร์ไม่ได้`);
  const d = await r.json();
  if (!d.chunks || !d.chunks.length) throw new Error("ไฟล์เวกเตอร์ว่างเปล่า");
  return d;
}

async function embedQuestion(q){
  const viaWorker = CFG.PROVIDER === "worker";
  const url = viaWorker ? workerURL("/api/v1/embeddings") : "https://openrouter.ai/api/v1/embeddings";
  const auth = viaWorker ? {} : { "Authorization": "Bearer " + CFG.KEY };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      model: VEC.model || CFG.EMBED_MODEL || "nvidia/nemotron-3.5-embed-1b:free",
      input: [q],
    }),
  });
  if (!res.ok) throw new Error(`แปลงคำถามไม่สำเร็จ`);
  const d = await res.json();
  const v = d.data?.[0]?.embedding;
  if (!v) throw new Error("ไม่ได้รับเวกเตอร์กลับมา");
  const n = Math.hypot(...v);
  return v.map(x => x / n);
}

function searchVector(qv){
  return VEC.chunks
    .map((c, i) => ({ i, score: c.v.reduce((s, x, k) => s + x * qv[k], 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.TOP_K || 3)
    .map(({ i, score }) => ({
      source: VEC.chunks[i].source, part: VEC.chunks[i].part,
      text: VEC.chunks[i].text, score: Math.round(score * 1000) / 1000,
    }));
}

async function findChunks(question){
  if (MODE === "vector") {
    try {
      const qv = await embedQuestion(question);
      return { found: searchVector(qv), how: "เวกเตอร์" };
    } catch (e) {
      MODE = "local";
      FELL_BACK = true;
      boot(bootLine() + " (ใช้ไม่ได้ สลับมาเทียบตัวอักษร)");
    }
  }
  return { found: search(question), how: "เทียบตัวอักษร" };
}

/* --- Prompt ของ Aura Beauty --- */
function makePrompt(question, found){
  const docs = found.map((f, i) =>
    `[อ้างอิง ${i + 1} จากไฟล์ ${f.source}]\n${f.text}`).join("\n\n");
  return `คุณคือ "Aura" ผู้ช่วยแนะนำความงามที่เชี่ยวชาญ สดใส ทันสมัย ของแบรนด์ Aura Beauty
ให้ตอบคำถามโดยอ้างอิงจากข้อมูลด้านล่างนี้เท่านั้น 

ถ้าไม่มีข้อมูลในเอกสาร ให้ตอบน่ารักๆ ว่า "ขออภัยน้าา แอดมิน AI ยังไม่มีข้อมูลสินค้านี้ค่ะ ลองทักหาพี่ๆ แอดมินคนสวยของเราได้เลยนะคะ 💕" 
ห้ามเดาข้อมูลเองเด็ดขาด ใช้ภาษาพูดที่เป็นมิตร ทันสมัย มีอิโมจิน่ารักๆ ประกอบ

เอกสารที่ค้นเจอ
${docs}

คำถามจากลูกค้า
${question}`;
}

async function askLLM(prompt){
  const p = PROVIDERS[CFG.PROVIDER];
  let url, body;
  if (p.style === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${CFG.MODEL}:generateContent`;
    body = { contents: [{ parts: [{ text: prompt }] }] };
  } else {
    url = CFG.PROVIDER === "worker" ? workerURL("/api/v1/chat/completions") : p.url;
    body = { model: CFG.MODEL, messages: [{ role: "user", content: prompt }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...p.auth(CFG.KEY) },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ไม่สามารถติดต่อ AI ได้ (${res.status})`);
  const d = await res.json();
  return p.style === "gemini"
    ? (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "ไม่ได้รับคำตอบ")
    : (d.choices?.[0]?.message?.content ?? "ไม่ได้รับคำตอบ");
}

function bootLine(){
  const files = new Set(CHUNKS.map(c => c.source)).size;
  const m = MODE === "vector" ? "เวกเตอร์" : "ตัวอักษร";
  return `พร้อมใช้งาน 💖 เอกสาร ${files} ไฟล์ (${m})`;
}

window.__startApp = async () => {
  CFG = window.CONFIG || {};
  CFG.KEY = (CFG.KEY || "").trim();
  try {
    boot("กำลังอ่านข้อมูลความสวย...");
    CHUNKS = await buildChunks();
    INDEX = CHUNKS.map(c => grams(c.text));
    MODE = "local";
    if ((CFG.SEARCH_MODE || "local") === "vector") {
      try { boot("กำลังโหลดเวกเตอร์..."); VEC = await loadVectors(); MODE = "vector"; } catch (e) {}
    }
    boot(bootLine());
    READY = true;
    onReady();
  } catch (e) { boot("เริ่มไม่สำเร็จ: " + e.message); }
};

async function askBot(question){
  if (!READY) throw new Error("ระบบยังไม่พร้อม");
  const { found, how } = await findChunks(question);
  const answer = await askLLM(makePrompt(question, found));
  const refs = `ค้นแบบ${how} ` + found.map(f => `[${f.source}]`).join(" ");
  return { answer, refs };
}

/* ==================================================================
   หน้าตาของกล่องแชต (UI ดีไซน์ใหม่ล่าสุด)
   ================================================================== */
(function(){
  const C = {
    main:  "#FF5E8E",   
    accent:"#FF9248",   
    ink:   "#2A1A1E",
    soft:  "#FFE5EC",
    line:  "#FFD1DF",
    bg:    "rgba(255, 255, 255, 0.7)", /* แบบกระจกใส */
    card:  "#FFFFFF",
    muted: "#8A6D75",
  };

  const css = `
@keyframes float-bot { 0% {transform: translateY(0px);} 50% {transform: translateY(-8px);} 100% {transform: translateY(0px);} }
@keyframes pop-in { 0% {opacity: 0; transform: scale(0.9) translateY(10px);} 100% {opacity: 1; transform: scale(1) translateY(0);} }

#pimbot-btn {
  position:fixed; right:24px; bottom:24px; z-index:9999;
  width:65px; height:65px; border-radius:50%; border:0; cursor:pointer;
  background: linear-gradient(135deg, ${C.main}, ${C.accent}); color:#fff;
  box-shadow:0 8px 25px rgba(255, 94, 142, 0.4);
  display:grid; place-items:center;
  font-family:'Prompt',system-ui,sans-serif;
  transition:transform .25s, box-shadow .25s;
  animation: float-bot 4s ease-in-out infinite;
}
#pimbot-btn:hover { transform:scale(1.1); box-shadow:0 12px 30px rgba(255, 94, 142, 0.6); animation: none; }
#pimbot-btn svg { width:30px; height:30px; fill: white;}

#pimbot-panel {
  position:fixed; right:24px; bottom:100px; z-index:9999;
  width:min(400px, calc(100vw - 32px));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 24px; overflow:hidden; display:none;
  box-shadow: 0 15px 40px rgba(0,0,0,0.12);
  font-family:'Prompt',system-ui,sans-serif;
  font-size:15px; line-height:1.6; color:${C.ink};
  transform-origin: bottom right;
}
#pimbot-panel.pimbot-open { display:block; animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

#pimbot-head {
  background: linear-gradient(135deg, ${C.main}, ${C.accent});
  color:#fff; padding:20px; position:relative; text-align: center;
}
#pimbot-head b { font-size:18px; font-weight:600; display:block; letter-spacing: 0.5px;}
#pimbot-head small { display:block; font-size:12px; color: rgba(255,255,255,0.85); margin-top:4px; }
#pimbot-close {
  position:absolute; top:15px; right:15px; background:rgba(255,255,255,0.2); 
  border:0; color:#fff; font-size:20px; line-height:1; cursor:pointer; 
  width:32px; height:32px; border-radius:50%; transition: background 0.2s;
}
#pimbot-close:hover { background: rgba(255,255,255,0.4); }

#pimbot-warn {
  background: ${C.soft}; border-bottom:1px solid ${C.line};
  padding:12px 18px; font-size:12px; line-height:1.6; color:${C.muted}; text-align:center;
}
#pimbot-warn b { color:${C.main}; font-size: 13px;}

#pimbot-log { height:320px; overflow-y:auto; padding:20px; background:${C.bg}; scrollbar-width: thin; scrollbar-color: ${C.line} transparent; }
#pimbot-log::-webkit-scrollbar { width: 6px; }
#pimbot-log::-webkit-scrollbar-thumb { background-color: ${C.line}; border-radius: 10px; }

.pimbot-m { max-width:85%; padding:12px 16px; border-radius:18px; margin:10px 0; font-size:14px; white-space:pre-wrap; line-height:1.6; animation: pop-in 0.3s ease forwards; box-shadow: 0 2px 10px rgba(0,0,0,0.03);}
.pimbot-me { margin-left:auto; background: linear-gradient(135deg, ${C.main}, ${C.accent}); color:#fff; border-bottom-right-radius:4px; }
.pimbot-bot { background:${C.card}; border:1px solid ${C.line}; border-bottom-left-radius:4px; position: relative; margin-left: 10px;}
.pimbot-src { display:block; margin-top:8px; font-size:11px; color:${C.muted}; border-top: 1px dashed ${C.line}; padding-top: 6px;}

#pimbot-chips { padding:10px 20px 15px; display:flex; flex-wrap:wrap; gap:8px; background:${C.bg}; }
#pimbot-chips span {
  font-size:12px; padding:6px 14px; border:1px solid ${C.main}; color: ${C.main};
  border-radius:20px; cursor:pointer; background:${C.card}; transition: all 0.2s; font-weight: 500;
}
#pimbot-chips span:hover { background:${C.main}; color:white; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(255, 94, 142, 0.2);}

#pimbot-row { display:flex; gap:10px; padding:15px; border-top:1px solid ${C.line}; background: ${C.card}; }
#pimbot-q {
  flex:1; padding:12px 16px; font-family:inherit; font-size:14px;
  border:1px solid ${C.line}; border-radius:20px; background:${C.bg}; color:${C.ink}; outline: none; transition: border-color 0.2s;
}
#pimbot-q:focus { border-color: ${C.main}; }
#pimbot-send {
  padding:0 20px; border:0; border-radius:20px;
  background: linear-gradient(45deg, ${C.main}, ${C.accent}); color:white;
  font-family:inherit; font-size:14px; font-weight:600; cursor:pointer; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(255, 94, 142, 0.3);
}
#pimbot-send:hover { transform: scale(1.05); }
#pimbot-send:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; transform: none;}
`;

  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.innerHTML = `
<button id="pimbot-btn" aria-label="เปิดกล่องแชท">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>
    <path d="M7 9h10v2H7zm0-3h10v2H7z"/>
  </svg>
</button>

<div id="pimbot-panel">
  <div id="pimbot-head">
    <button id="pimbot-close" aria-label="ปิด">×</button>
    <b>Aura Beauty ✨</b>
    <small id="pimbot-status">ระบบกำลังเตรียมความสวย...</small>
  </div>
  <div id="pimbot-warn">
    <b>AI Beauty Advisor ยินดีให้บริการ 💋</b><br>
    ถามเรื่องสกินแคร์ เมคอัพ หรือโปรโมชั่นได้เลยค่ะ<br>
    <span style="font-size: 11px;">(ติดต่อพนักงาน โทร 0-2000-0002)</span>
  </div>
  <div id="pimbot-log"></div>
  <div id="pimbot-chips">
    <span>ผิวแห้งแต่งหน้าไม่ติด 💧</span>
    <span>เซรั่มวิตามินซีช่วยอะไร? 🍊</span>
    <span>มีโปรโมชั่นอะไรบ้าง 🎁</span>
  </div>
  <div id="pimbot-row">
    <input id="pimbot-q" type="text" placeholder="พิมพ์ข้อความที่นี่..." disabled>
    <button id="pimbot-send" disabled>ส่ง</button>
  </div>
</div>`;
  document.body.appendChild(wrap);

  onStatus = (t) => { $("pimbot-status").textContent = String(t).split("\n")[0]; };

  onReady = () => {
    $("pimbot-q").disabled = false;
    $("pimbot-send").disabled = false;
    say("สวัสดีค่าา 💖 Aura ยินดีให้คำปรึกษาค่ะ วันนี้อยากให้ช่วยดูแลเรื่องผิว หรือแนะนำไอเทมเด็ดตัวไหนดีคะ?", "bot");
  };

  function say(text, who, src){
    const d = document.createElement("div");
    d.className = "pimbot-m " + (who === "me" ? "pimbot-me" : "pimbot-bot");
    d.textContent = text;
    if (src) {
      const s = document.createElement("span");
      s.className = "pimbot-src"; s.textContent = src; d.appendChild(s);
    }
    $("pimbot-log").appendChild(d);
    $("pimbot-log").scrollTop = $("pimbot-log").scrollHeight;
    return d;
  }

  async function send(){
    const t = $("pimbot-q").value.trim();
    if (!t) return;
    $("pimbot-q").value = "";
    say(t, "me");
    const holder = say("Aura กำลังค้นข้อมูลให้แป๊บนึงนะคะ...", "bot");
    try {
      const { answer, refs } = await askBot(t);
      holder.textContent = answer;
      const s = document.createElement("span"); s.className = "pimbot-src"; s.textContent = refs; holder.appendChild(s);
    } catch (e) {
      const m = e.message || String(e);
      holder.textContent = m.includes("429") ? "ตอนนี้สาวๆ ทักมาเยอะมาก คิวเต็มนิดนึงน้า รอแป๊บแล้วส่งใหม่นะคะ 💖"
        : m.includes("401") || m.includes("403") ? "ระบบยังเชื่อมต่อไม่สมบูรณ์ แจ้งแอดมินให้หน่อยน้า"
        : "เกิดข้อผิดพลาดจ้า\n\n" + m;
    }
    $("pimbot-log").scrollTop = $("pimbot-log").scrollHeight;
  }

  $("pimbot-btn").addEventListener("click", () => {
    const open = $("pimbot-panel").classList.toggle("pimbot-open");
    if (open) $("pimbot-q").focus();
  });
  $("pimbot-close").addEventListener("click", () => $("pimbot-panel").classList.remove("pimbot-open"));
  $("pimbot-send").addEventListener("click", send);
  $("pimbot-q").addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  document.querySelectorAll("#pimbot-chips span").forEach(el =>
    el.addEventListener("click", () => { $("pimbot-q").value = el.textContent; send(); }));
})();
