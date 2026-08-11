# Chiang Rai iOS-style LINE Mini App

โปรเจกต์ Vite + TypeScript สำหรับเทศบาลนครเชียงราย พร้อม LIFF, Supabase, Leaflet, iOS UI และ Vercel.

## ฟังก์ชันที่พร้อมใช้

- LIFF login และดึงชื่อ/รูปโปรไฟล์ LINE (โหลด LIFF SDK จาก CDN ทางการ)
- โหมด Demo อัตโนมัติเมื่อยังไม่มีคีย์
- หน้า Dashboard, บริการ, แผนที่, ตั้งค่า
- สภาพอากาศเชียงรายจริงผ่าน Open-Meteo (fallback เมื่อเครือข่ายขัดข้อง)
- แบบฟอร์มแจ้งปัญหา 3 ขั้นตอน
- ระบุตำแหน่งด้วย Geolocation
- แนบและอัปโหลดรูปภาพไป Supabase Storage
- บันทึกคำร้องลง Supabase หรือ localStorage ในโหมด Demo
- ดึงรายการบริการ ข่าว กิจกรรม และจุดคำร้องแบบไม่เปิดเผยข้อมูลส่วนบุคคลจาก Supabase
- iOS safe area, glass effect, switches, tap feedback, swipe carousel และ dark mode
- Vercel SPA rewrite

## 1) รันในเครื่อง

```bash
npm install
cp .env.example .env
npm run dev
```

เปิด `http://localhost:5173`

## 2) ตั้งค่า Supabase

1. สร้าง Supabase project
2. เปิด SQL Editor แล้วรันไฟล์ `supabase/schema.sql`
3. ไปที่ Project Settings > API
4. คัดลอก Project URL และ anon/publishable key ลง `.env`

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

> นโยบาย RLS ในตัวอย่างอนุญาตให้ส่งคำร้องจาก client เพื่อเริ่มต้นได้ง่าย สำหรับ production ที่มีข้อมูลอ่อนไหว ควรตรวจสอบ LIFF access token ผ่าน Supabase Edge Function ก่อน insert.

## 3) ตั้งค่า LINE LIFF

1. สร้าง LINE Login channel ใน LINE Developers Console
2. เพิ่ม LIFF app และกำหนด Endpoint URL เป็น URL ของ Vercel
3. เลือก scope `profile` และ `openid`
4. ใส่ LIFF ID ใน `.env`

```env
VITE_LIFF_ID=1234567890-AbCdEfGh
```

ระหว่างทดสอบ local ให้เพิ่ม URL ที่เข้าถึงผ่าน HTTPS เป็น Endpoint/LIFF URL เช่น Vercel Preview หรือ tunnel ที่เชื่อถือได้.

## 4) Deploy Vercel

- Push โปรเจกต์ขึ้น GitHub แล้ว Import ใน Vercel
- Framework Preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- เพิ่ม Environment Variables ทั้งสามตัว
- Deploy แล้วนำ Production URL ไปใส่เป็น LIFF Endpoint URL

หรือ CLI:

```bash
npm i -g vercel
vercel
vercel --prod
```

## โครงสร้างข้อมูล

- `services`: เมนูที่ผู้ดูแลเปิด/ปิดได้
- `news`: ข่าวและกิจกรรม
- `complaints`: คำร้องพร้อมพิกัดและสถานะ
- Storage bucket `complaint-images`: รูปประกอบคำร้อง

## หมายเหตุด้านความปลอดภัย

LIFF profile จาก client ช่วยระบุผู้ใช้ใน UI แต่ไม่ควรถือเป็นการยืนยันตัวตนฝั่งฐานข้อมูลโดยลำพัง หากเปิดใช้จริงในหน่วยงาน ให้เพิ่ม Edge Function สำหรับตรวจ LIFF access token, จำกัดชนิด/ขนาดไฟล์, ทำ rate limiting และกำหนดสิทธิ์เจ้าหน้าที่แยกต่างหาก.


## CDN ที่ใช้

LIFF SDK, Supabase JS และ Leaflet โหลดจาก CDN ใน `index.html` เพื่อลดปัญหา bundle และทำให้เปลี่ยนค่าคอนฟิกได้ง่าย โดย Vite ใช้สำหรับพัฒนาและ build source TypeScript.
