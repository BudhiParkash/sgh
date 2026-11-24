import { CATEGORY_LABELS } from "@sgh/shared";

/** Educational content (genuine, game-mechanics explanation — no invented numbers). */
export function SensitivityExplainer() {
  const items: { key: keyof typeof CATEGORY_LABELS; body: string }[] = [
    { key: "camera", body: "How fast your view turns when you swipe to look around without aiming. Higher values turn faster with a shorter swipe; lower values are steadier for scanning." },
    { key: "ads", body: "How fast your view moves while aiming down sights or a scope. This is what you drag against to control recoil when you don't use the gyroscope." },
    { key: "gyro", body: "How much the view turns when you physically move your phone while not aiming. Higher values need less phone movement." },
    { key: "ads_gyro", body: "Gyroscope sensitivity while aiming. Most gyro players control recoil by tilting the phone, so this matters most for spray control." },
  ];
  return (
    <section aria-labelledby="how-it-works" className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h2 id="how-it-works" className="text-display font-bold">How sensitivity works</h2>
        <p className="mt-4 text-muted">
          BGMI and PUBG Mobile let you set a separate value for every scope in each of four categories. There is no separate setting per gun —
          a &ldquo;M416 sensitivity&rdquo; simply means the values of the scope you use on the M416. That&apos;s why our gun guides explain
          recoil and point you to the right scope rows instead of inventing per-gun numbers.
        </p>
        <h3 className="mt-6 text-lg font-semibold">Fine-tuning a setup</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
          <li>Start from the setup closest to your device, FPS and gyroscope mode.</li>
          <li>Test in the training ground on a target at 50–100 m with your usual gun and scope.</li>
          <li>If your aim climbs above the target, increase the value for that scope by 5–10%; if it drops below, decrease it.</li>
          <li>Change one scope at a time and re-test — small steps beat big jumps.</li>
        </ol>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.key} className="rounded-lg border border-border bg-surface-1 p-5">
            <dt className="font-semibold">{CATEGORY_LABELS[i.key]}</dt>
            <dd className="mt-2 text-sm text-muted">{i.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
