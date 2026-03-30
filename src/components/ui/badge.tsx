"use client";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "success" | "warning" | "critical" | "ai" | "neutral"
  | "int" | "ext" | "day" | "night";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  success: "badge-success",
  warning: "badge-warning",
  critical: "badge-critical",
  ai: "badge-ai",
  neutral: "badge-neutral",
  int: "badge-int",
  ext: "badge-ext",
  day: "badge-day",
  night: "badge-night",
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn("badge", variantClass[variant], className)}>
      {children}
    </span>
  );
}
