import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roastery ERP",
  description: "App quản lý xưởng rang + CRM + ERP mini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
