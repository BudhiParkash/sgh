import type { Page } from "@playwright/test";

/** Wait until all finite CSS/Web animations and transitions (entrance, reveals) have finished. */
export async function waitForAnimationsToSettle(page: Page, timeout = 8000) {
  try {
    await page.waitForFunction(
      () =>
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .every((a) => a.playState === "finished" || a.playState === "idle"),
      undefined,
      { timeout },
    );
  } catch (err) {
    const pending = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity && a.playState !== "finished")
        .map((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as HTMLElement | null;
          const name = (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName ?? a.constructor.name;
          return `${name} [${a.playState}] on <${t?.tagName.toLowerCase()} class="${String(t?.className ?? "").slice(0, 80)}">`;
        }),
    );
    throw new Error(`Animations did not settle: ${pending.join("; ")}`, { cause: err });
  }
}
