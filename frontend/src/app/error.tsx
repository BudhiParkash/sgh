"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-xl items-center px-4 py-24">
      <ErrorState
        className="w-full"
        title="Something went wrong"
        description="An unexpected error occurred. Please try again."
        requestId={error.digest}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
