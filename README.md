# Roastery ERP Web (Supabase-first)
Next.js 14 (App Router) + Tailwind + Supabase Auth + MVP pages for Roastery/CRM/ERP mini.

## 1) Setup env
Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

## 2) Create DB schema (one-time)
Supabase Dashboard → SQL Editor → New Query → run:

`supabase/migrations/0001_init.sql`

> This creates MVP tables and permissive RLS (authenticated can read/write). Tighten later.

## 3) Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy (Vercel)
- Push to GitHub
- Import repo in Vercel
- Set env vars in Vercel:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY


## Auth note (important)
This project uses cookie-based auth for middleware route protection.
Login is implemented via `/api/auth/login` so the middleware can read the session.
If you change auth flows, ensure cookies are set.


## Step 2 (không lỗi): bật RLS + tạo dữ liệu mẫu
1) Chạy SQL: `supabase/migrations/0002_rls_mvp.sql` trong Supabase SQL Editor.
2) Vào web app -> Products/Customers -> bấm nút **Seed dữ liệu mẫu**.


## Step 3: CRUD Products + Customers (UI)
- Trang Sản phẩm/Khách hàng có nút Thêm/Sửa/Xoá.
- API: `/api/products` và `/api/customers`.


## Step 4: Tạo đơn hàng (MVP)
- Vào Đơn hàng -> + Tạo đơn hàng -> chọn khách + thêm sản phẩm + nhập SL/giá.
- Lưu sẽ tạo `orders` + `order_items` và tự tính total/cost/profit.
