import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { siteConfig, socialLabels } from "@/lib/site";

const blurbs: Partial<Record<keyof typeof siteConfig.socials, string>> = {
  youtube: "Gameplay, sensitivity tests and tournament highlights.",
  instagram: "Reels, quick tips and announcements.",
  instagramChannel: "Broadcast channel for instant updates.",
  facebook: "Community posts and updates.",
};

export function Community() {
  const links = (Object.entries(siteConfig.socials) as [keyof typeof siteConfig.socials, string][]).filter(([, u]) => u);
  if (links.length === 0) return null;
  return (
    <Section id="community" eyebrow="Community" title="Join Shivanshi Gaming" description="Official channels only — we never ask for your game login or payments.">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(([key, url], i) => (
          <li key={key} data-reveal style={{ "--reveal-i": i } as React.CSSProperties}>
            <Card interactive className="flex h-full flex-col gap-2 p-5">
              <h3 className="flex items-center justify-between text-lg font-semibold">
                <a href={url} target="_blank" rel="noopener noreferrer me" className="after:absolute after:inset-0 focus-visible:outline-none">
                  {socialLabels[key]}
                </a>
                <ArrowUpRight className="size-5 text-subtle" aria-hidden="true" />
              </h3>
              {blurbs[key] && <p className="text-sm text-muted">{blurbs[key]}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}
