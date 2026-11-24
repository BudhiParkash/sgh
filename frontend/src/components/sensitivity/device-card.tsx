import Link from "next/link";
import { Smartphone } from "lucide-react";
import type { DeviceSummary } from "@sgh/shared";
import { Card } from "@/components/ui/card";

export function DeviceCard({ d }: { d: DeviceSummary }) {
  return (
    <Card interactive className="flex h-full flex-col gap-3 p-5">
      <div className="grid size-11 place-items-center rounded-md bg-surface-2 text-primary-hover" aria-hidden="true">
        <Smartphone className="size-5" />
      </div>
      <div>
        <p className="text-xs font-medium tracking-wider text-subtle uppercase">{d.brand}</p>
        <h3 className="text-base font-semibold">
          <Link href={`/sensitivity/devices/${d.brandSlug}/${d.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {d.model}
          </Link>
        </h3>
      </div>
      <p className="mt-auto text-sm text-muted">
        {d.configCount} {d.configCount === 1 ? "setup" : "setups"}
        {d.supportedFps.length > 0 && <> · up to {Math.max(...d.supportedFps)} FPS</>}
      </p>
    </Card>
  );
}
