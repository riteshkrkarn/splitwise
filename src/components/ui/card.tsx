import type { HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_var(--shadow)]",
        className
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>
        )}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-bg px-5 py-8">
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-ring/25",
        className
      )}
      {...props}
    />
  );
}
