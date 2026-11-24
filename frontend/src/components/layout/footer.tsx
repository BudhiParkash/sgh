import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CookieSettingsButton } from "@/components/consent/consent-manager";
import { InstallAppButton } from "@/components/retention/install-app";
import { ReduceEffectsToggle } from "@/components/motion/reduce-effects-toggle";
import { Container } from "@/components/ui/container";
import { footerNav, siteConfig, socialLabels } from "@/lib/site";

export function Footer() {
  const socials = (Object.entries(siteConfig.socials) as [keyof typeof siteConfig.socials, string][]).filter(
    ([, url]) => url.length > 0,
  );
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-1/60">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
          <Logo />
          <p className="max-w-sm text-sm text-muted">{siteConfig.description}</p>
          <address className="text-sm text-muted not-italic">
            Contact:{" "}
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="inline-flex min-h-11 items-center break-all text-text underline-offset-4 hover:underline"
            >
              {siteConfig.contact.email}
            </a>
          </address>
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Official social channels">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted hover:border-border-strong hover:text-text"
                  >
                    {socialLabels[key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {footerNav.map((group) => (
          <nav key={group.title} aria-label={group.title} className={group.title === "Legal" ? "row-span-2 lg:row-span-1" : undefined}>
            <h2 className="mb-3 font-display text-sm font-semibold tracking-wider text-text uppercase">
              {group.title}
            </h2>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-10 items-center text-sm text-muted hover:text-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-3 py-6 text-xs text-subtle md:flex-row md:items-start md:justify-between">
          <p className="max-w-3xl">{siteConfig.disclaimer}</p>
          <div className="flex shrink-0 flex-col gap-1 md:items-end">
            <div className="flex flex-wrap items-center gap-4"><InstallAppButton /><CookieSettingsButton /><ReduceEffectsToggle /></div>
            <p>
              © {year} {siteConfig.name}
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
