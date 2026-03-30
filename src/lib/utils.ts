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

export function formatCompact(amount: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 10000000) return `${symbol}${(amount / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`;
  if (amount >= 100000) return `${symbol}${(amount / 100000).toFixed(1).replace(/\.0$/, "")} L`;
  if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(0)}K`;
  return `${symbol}${amount}`;
}

export function formatDelta(delta: number, currency = "INR"): string {
  const abs = Math.abs(delta);
  const sign = delta >= 0 ? "+" : "-";
  return sign + formatCurrency(abs, currency);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

function threeDigitWords(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigitWords(n);
  const h = ONES[Math.floor(n / 100)];
  const rem = n % 100;
  return rem ? `${h} Hundred ${twoDigitWords(rem)}` : `${h} Hundred`;
}

export function amountToWords(amount: number, currency: string = "INR"): string {
  if (!amount || amount <= 0) return "";
  const n = Math.round(amount);
  if (n === 0) return "";

  if (currency === "INR") {
    // Indian: Crores (10^7), Lakhs (10^5), Thousands, Hundreds
    const crores = Math.floor(n / 10000000);
    const lakhs = Math.floor((n % 10000000) / 100000);
    const thousands = Math.floor((n % 100000) / 1000);
    const hundreds = n % 1000;

    const parts: string[] = [];
    if (crores) parts.push(`${threeDigitWords(crores)} ${crores === 1 ? "Crore" : "Crores"}`);
    if (lakhs) parts.push(`${twoDigitWords(lakhs)} ${lakhs === 1 ? "Lakh" : "Lakhs"}`);
    if (thousands) parts.push(`${twoDigitWords(thousands)} Thousand`);
    if (hundreds && (crores || lakhs || thousands)) parts.push(threeDigitWords(hundreds));
    else if (hundreds) parts.push(threeDigitWords(hundreds));

    return parts.join(" ") || "";
  }

  // Western: Billions, Millions, Thousands
  const billions = Math.floor(n / 1000000000);
  const millions = Math.floor((n % 1000000000) / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const hundreds = n % 1000;

  const parts: string[] = [];
  if (billions) parts.push(`${threeDigitWords(billions)} ${billions === 1 ? "Billion" : "Billion"}`);
  if (millions) parts.push(`${threeDigitWords(millions)} ${millions === 1 ? "Million" : "Million"}`);
  if (thousands) parts.push(`${threeDigitWords(thousands)} Thousand`);
  if (hundreds && (billions || millions || thousands)) parts.push(threeDigitWords(hundreds));
  else if (hundreds) parts.push(threeDigitWords(hundreds));

  return parts.join(" ") || "";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "scheduled": return "#3b82f6";
    case "completed": return "#10b981";
    default: return "#6b7280";
  }
}
