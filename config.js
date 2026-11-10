/* ==================================================================
   ไฟล์ตั้งค่าของ AjGolf AI
   แก้ไฟล์นี้ไฟล์เดียว  ไม่ต้องแตะ index.html เลย
   ------------------------------------------------------------------
   คำเตือนสำคัญ
   ไฟล์นี้ถูกเผยแพร่ต่อสาธารณะเหมือนไฟล์อื่นใน repo
   ใครก็เปิด  https://ชื่อผู้ใช้.github.io/ชื่อrepo/config.js  แล้วเห็นกุญแจได้
   การแยกไฟล์จึงช่วยให้จัดการง่ายขึ้น  แต่ไม่ได้ทำให้ปลอดภัยขึ้น
   ================================================================== */

window.CONFIG = {

  // ---------- กุญแจจาก Google AI Studio ----------
  // ขอได้ที่  aistudio.google.com/apikey
  KEY: "AQ.Ab8RN6KUIIe16LEXzZ3o1uodlQWtrYXo9O-uei2sbvKIezJF4A",

  // ---------- ที่อยู่ของเอกสาร ----------
  // เก็บไว้ใน repo เดียวกัน      ใช้  "docs"
  // ดึงจาก Hugging Face Space   ใช้  "https://ชื่อผู้ใช้-ชื่อspace.hf.space/docs"
  DOCS_BASE: "docs",

  // ---------- รายชื่อไฟล์เอกสาร ----------
  FILES: [
    "01-skincare.txt",
    "02-makeup.txt",
    "03-bodycare-fragrance.txt",
    "04-haircare.txt",
    "05-nailcare.txt",
    "06-promotion-and-faq.txt",
    "07-lipcare.txt",
    "08-ingredients-safety.txt",
    "09-beauty-routine-tips.txt",
    "10-member-rewards.txt"
  ],

};
