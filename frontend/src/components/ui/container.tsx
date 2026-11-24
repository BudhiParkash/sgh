import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

/** Page section with consistent vertical rhythm (64px mobile → 128px desktop) and heading. */
export function Section({ eyebrow, title, description, action, className, children, ...props }: SectionProps) {
  const headingId = title ? `${props.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("py-16 lg:py-32", className)} {...props}>
      <Container>
        {title && (
          <div className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              {eyebrow && (
                <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary-hover uppercase">{eyebrow}</p>
              )}
              <h2 id={headingId} className="text-display font-bold">
                {title}
              </h2>
              {description && <p className="mt-3 text-muted md:text-lg">{description}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
