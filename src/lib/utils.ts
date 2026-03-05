import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  if (currency === "INR") {
    return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(amount));
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDelta(delta: number, currency = "INR"): string {
  const abs = Math.abs(delta);
  const sign = delta >= 0 ? "+" : "-";
  return sign + formatCurrency(abs, currency);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "scheduled": return "#3b82f6";
    case "completed": return "#10b981";
    default: return "#6b7280";
  }
}
