"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps {
  /**
   * Size of the loader
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "xl";
  
  /**
   * Text to display below the spinner
   */
  text?: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether to show a full-screen overlay
   * @default false
   */
  fullScreen?: boolean;
  
  /**
   * Variant of the loader
   * @default "default"
   */
  variant?: "default" | "minimal" | "inline";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function Loader({
  size = "md",
  text,
  className,
  fullScreen = false,
  variant = "default",
}: LoaderProps) {
  const spinner = (
    <Loader2
      className={cn(
        "animate-spin text-purple-600",
        sizeClasses[size],
        className
      )}
    />
  );

  if (variant === "inline") {
    return (
      <div className="inline-flex items-center gap-2">
        {spinner}
        {text && (
          <span className={cn("text-gray-600", textSizeClasses[size])}>
            {text}
          </span>
        )}
      </div>
    );
  }

  if (variant === "minimal") {
    return spinner;
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      {text && (
        <p className={cn("text-gray-600 font-medium", textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[200px] py-12">
      {content}
    </div>
  );
}

/**
 * Full page loader component
 */
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return <Loader size="lg" text={text} fullScreen />;
}

/**
 * Inline loader for buttons and small spaces
 */
export function InlineLoader({ text, size = "sm" }: { text?: string; size?: "sm" | "md" | "lg" }) {
  return <Loader variant="inline" size={size} text={text} />;
}

/**
 * Minimal spinner (just the icon)
 */
export function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return <Loader variant="minimal" size={size} className={className} />;
}

/**
 * Table loading row
 */
export function TableLoader({ colSpan, text = "Loading..." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <Loader size="md" text={text} />
      </td>
    </tr>
  );
}

