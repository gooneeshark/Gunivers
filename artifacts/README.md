# การเพิ่ม Artifact

อัปโหลดไฟล์ `.html` เข้ามาในโฟลเดอร์นี้ผ่าน GitHub ได้ทันที เมื่อ Netlify deploy ระบบจะเพิ่มผลงานลงหน้า Artist อัตโนมัติ

ระบบอ่านชื่อจาก `<title>` และคำอธิบายจาก `<meta name="description">` ภายใน HTML โดยไม่ต้องแก้โค้ดหลัก หากมีภาพปก ให้ใส่ `<meta property="og:image" content="cover.webp">` และอัปโหลดภาพไว้ข้างไฟล์ HTML ภาพปกเป็นตัวเลือก ไม่ควรใช้รูป Base64 เป็น `og:image` เพราะระบบตั้งใจไม่โหลดรูปขนาดใหญ่บนหน้าหลัก

ข้อมูลเสริมที่ใส่ได้:

```html
<meta name="artifact:type" content="Storyboard">
<meta name="artifact:date" content="2026-09-17">
```

เมื่อกด Preview หน้าเว็บจึงโหลด Artifact ในหน้าต่างแยก และปุ่มเปิดเต็มหน้าจอจะเปิดไฟล์ต้นฉบับโดยตรง
