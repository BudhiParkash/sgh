import type { WeaponSummary } from "@sgh/shared";
import { WeaponCard } from "@/components/sensitivity/weapon-card";
import { Section } from "@/components/ui/container";

export function GunGuides({ weapons }: { weapons: WeaponSummary[] }) {
  if (weapons.length === 0) return null;
  return (
    <Section
      id="guns"
      eyebrow="Gun guides"
      title="Popular gun guides"
      description="In BGMI, sensitivity is set per scope, not per gun. These guides explain how each gun behaves and which scope settings matter most for it."
    >
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {weapons.map((w, i) => (
          <li key={w.id} data-reveal style={{ "--reveal-i": i % 7 } as React.CSSProperties}>
            <WeaponCard w={w} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
