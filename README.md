# Roastery ERP Web (Supabase + Next.js + Vercel)

## 1) Tạo database (1 lần)

Supabase Dashboard → **SQL Editor** → dán toàn bộ file `supabase-full-schema.sql` → Run.

## 2) Chạy local

```bash
npm install
cp .env.example .env.local
```

Điền:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Sau đó:

```bash
npm run dev
```

## 3) Deploy Vercel

Import repo GitHub → set Environment Variables giống `.env.local` → Deploy.

---

### Modules (MVP)

- Nhập nhân xanh theo lô (`/inventory-in`)
- CRM Leads pipeline (`/leads`)
- Đơn hàng (MVP) (`/orders`)
- Thu tiền (MVP) (`/payments`)
- Hoa hồng (MVP) (`/commissions`)
- Check-in GPS (SFA) (`/checkins`)
