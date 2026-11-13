/* ==================================================================
   ไฟล์ตั้งค่าของระบบ  ฉบับตั้งต้น
   ------------------------------------------------------------------
   แก้สามบรรทัดที่มีคำว่า  แก้ตรงนี้  เท่านั้น
   ไฟล์นี้ไม่มีกุญแจ  จึงอัปขึ้น GitHub ได้อย่างปลอดภัย
   ================================================================== */

window.CONFIG = {

  /* ===== ส่งผ่าน Cloudflare Worker  กุญแจอยู่บนเซิร์ฟเวอร์ ===== */
  PROVIDER: "worker",

  // แก้ตรงนี้  ที่อยู่ Worker ของคุณ  ห้ามใส่ทับปิดท้าย
  // หน้าตาแบบนี้  https://ชื่อworker.ชื่อบัญชี.workers.dev
  WORKER_URL: "https://aura-beauty-bot.namebam0123.workers.dev",

  // ไม่ต้องใส่  เว้นว่างไว้  เพราะกุญแจอยู่ที่ Worker แล้ว
  KEY: "",


  /* ===== การค้นหา ===== */

  // เริ่มด้วย local ก่อนเสมอ  แล้วค่อยเปลี่ยนเป็น vector หลังสร้าง vectors.json
  SEARCH_MODE: "local",

  // รุ่นที่ใช้แปลงเวกเตอร์  ต้องตรงกับตอนสร้าง vectors.json
  EMBED_MODEL: "sentence-transformers/all-minilm-l6-v2:free",

  VECTORS_FILE: "vectors.json",


  /* ===== การตอบคำถาม ===== */

  // แก้ตรงนี้  ชื่อรุ่นจริงจากหน้า Models ของ OpenRouter
  // หาชื่อจริงได้ที่  https://openrouter.ai/api/v1/models
  MODEL: "google/gemini-1.5-flash",


  /* ===== เอกสาร ===== */

  // แก้ตรงนี้ถ้าเก็บไฟล์ .txt ไว้ชั้นเดียวกับ index.html  ให้ใส่ค่าว่าง  ""
  DOCS_BASE: "docs",

  FILES: [
    "01-skincare.txt",
    "02-makeup.txt",
    "03-bodycare-fragrance.txt",
    "04-haircare.txt",
    "05-nailcare.txt",
    "06-lipcare.txt",
    "07-ingredients-safety.txt",
    "08-beauty-routine-tips.txt",
    "09-member-rewards.txt",
    "10-promotion-and-faq.txt"
  ],


  /* ===== ปรับละเอียด  ปกติไม่ต้องแก้ ===== */
  CHUNK_SIZE: 500,
  OVERLAP: 100,
  TOP_K: 3,

};
