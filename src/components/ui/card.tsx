"use client";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, elevated, onClick }: CardProps) {
  return (
    <div
      className={cn(elevated ? "sf-card-elevated" : "sf-card", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
