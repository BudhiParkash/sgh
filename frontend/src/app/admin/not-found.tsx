import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Admin 404 (e.g. a deleted item or an unknown section) — stays inside the admin shell, no public header. */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="text-muted">This item or section doesn&apos;t exist, or it was deleted.</p>
      <Button asChild size="sm">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
}
