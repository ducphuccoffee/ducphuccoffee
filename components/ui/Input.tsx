import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 focus:ring-2 focus:ring-zinc-300",
        className
      )}
      {...props}
    />
  );
}
