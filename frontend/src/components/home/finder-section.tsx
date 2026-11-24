import type { BrandSummary } from "@sgh/shared";
import { FinderForm } from "@/components/sensitivity/finder-form";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { SensitivityScene } from "./sensitivity-scene";

export function FinderSection({ brands }: { brands: BrandSummary[] }) {
  return (
    <Section
      id="finder"
      eyebrow="Sensitivity Hub"
      title="Find your sensitivity"
      description="Pick your phone, frame rate, gyroscope mode and playstyle. Every setup shows who tested it, on which device and game version."
      className="relative"
    >
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Card data-reveal className="p-5 md:p-8">
          {brands.length > 0 ? (
            <FinderForm brands={brands} />
          ) : (
            <EmptyState level={3}
              className="border-0 bg-transparent"
              title="Device setups are being tested"
              description="We publish a setup only after testing it on a real device. The first tested phones will appear here soon."
            />
          )}
        </Card>
        <div className="relative hidden aspect-square md:block" aria-hidden="true">
          <SensitivityScene />
        </div>
      </div>
    </Section>
  );
}
