/* ==================================================================
   Cloudflare Worker  ตัวกลางระหว่างหน้าเว็บกับ OpenRouter

   หน้าที่
     1  รับคำขอจากหน้าเว็บบน GitHub Pages
     2  เติมกุญแจเข้าไป  แล้วส่งต่อให้ OpenRouter
     3  ส่งคำตอบกลับไปให้หน้าเว็บ

   ผลคือกุญแจอยู่บนเซิร์ฟเวอร์ของ Cloudflare เท่านั้น
   ไม่มีอยู่ในไฟล์ไหนบน GitHub จึงไม่ถูกเพิกถอน

   กุญแจเก็บเป็น Secret ชื่อ OPENROUTER_KEY  ไม่ได้เขียนไว้ในไฟล์นี้
   ================================================================== */

// โดเมนที่อนุญาตให้เรียก  กันคนอื่นเอา Worker เราไปใช้ฟรี
const ALLOWED = [
  "https://ชื่อผู้ใช้.github.io",   // <<< แก้ตรงนี้เป็นโดเมนของคุณ
  "http://localhost:8000",          // เผื่อทดสอบบนเครื่องตัวเอง
];

// เส้นทางที่ยอมให้ส่งต่อ  กันไม่ให้เรียก endpoint อื่นของ OpenRouter
const ALLOWED_PATHS = [
  "/api/v1/chat/completions",
  "/api/v1/embeddings",
];

const UPSTREAM = "https://openrouter.ai";

function corsHeaders(origin) {
  const ok = ALLOWED.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // เบราว์เซอร์ถามก่อนว่าเรียกได้ไหม
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // หน้าเช็กสุขภาพ  เปิดด้วยเบราว์เซอร์ได้
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json(
        { status: "ok", hasKey: Boolean(env.OPENROUTER_KEY) },
        { headers: cors }
      );
    }

    if (request.method !== "POST") {
      return Response.json({ error: "รับเฉพาะ POST" }, { status: 405, headers: cors });
    }

    // ตรวจว่าเรียกมาจากเว็บที่อนุญาต
    if (origin && !ALLOWED.includes(origin)) {
      return Response.json(
        { error: `โดเมน ${origin} ไม่ได้รับอนุญาต  แก้รายการ ALLOWED ในไฟล์ worker.js` },
        { status: 403, headers: cors }
      );
    }

    // ตรวจว่าเส้นทางที่ขอมาอยู่ในรายการที่ยอม
    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return Response.json(
        { error: `เส้นทาง ${url.pathname} ไม่ได้รับอนุญาต` },
        { status: 404, headers: cors }
      );
    }

    if (!env.OPENROUTER_KEY) {
      return Response.json(
        { error: "ยังไม่ได้ตั้ง Secret ชื่อ OPENROUTER_KEY ใน Cloudflare" },
        { status: 500, headers: cors }
      );
    }

    // ส่งต่อไปยัง OpenRouter พร้อมเติมกุญแจ
    try {
      const upstream = await fetch(UPSTREAM + url.pathname, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + env.OPENROUTER_KEY,
          "HTTP-Referer": origin || ALLOWED[0],
          "X-Title": "AjGolf AI",
        },
        body: await request.text(),
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      return Response.json(
        { error: "ส่งต่อไป OpenRouter ไม่สำเร็จ: " + e.message },
        { status: 502, headers: cors }
      );
    }
  },
};
