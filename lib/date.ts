/**
 * Shared date/time/currency formatters for the entire app.
 * Always use Asia/Ho_Chi_Minh timezone to avoid SSR ↔ client hydration mismatch.
 */

export function formatDateVN(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(date));
}

export function formatDateTimeVN(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatCurrencyVN(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export function formatWeekdayDateVN(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTimeVN(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
