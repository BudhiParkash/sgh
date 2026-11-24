import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 aria-busy:cursor-progress",
    "[&_svg]:size-[1.1em] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary-solid text-primary-fg shadow-md [@media(hover:hover)]:hover:bg-primary-solid-hover [@media(hover:hover)]:hover:shadow-glow",
        secondary:
          "border border-border-strong bg-surface-2 text-text [@media(hover:hover)]:hover:border-primary/60 [@media(hover:hover)]:hover:bg-surface-3",
        ghost: "text-muted [@media(hover:hover)]:hover:bg-surface-2 [@media(hover:hover)]:hover:text-text",
        link: "h-auto px-0 text-secondary underline-offset-4 [@media(hover:hover)]:hover:underline",
        danger: "bg-danger-solid text-white [@media(hover:hover)]:hover:bg-red-700",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-[0.95rem]", // 44px touch target
        lg: "h-12 px-7 text-base",
        icon: "size-11",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a Next.js Link) with button styling. */
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
