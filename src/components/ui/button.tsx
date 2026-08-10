import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,opacity,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:brightness-110 active:brightness-95",
        secondary: "border border-border bg-surface text-ink hover:bg-border/40",
        outline: "border border-border bg-transparent text-ink hover:bg-surface",
        ghost: "text-ink hover:bg-surface",
        danger: "bg-danger text-danger-fg hover:brightness-110",
        accent: "bg-accent text-accent-fg hover:brightness-110",
      },
      size: {
        default: "h-11 min-h-11 px-4 py-2",
        sm: "h-9 min-h-9 rounded-lg px-3 text-xs",
        lg: "h-12 min-h-12 px-6 text-base",
        icon: "h-10 w-10 min-h-10 min-w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";
