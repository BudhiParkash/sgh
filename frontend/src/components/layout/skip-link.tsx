export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary-solid focus:px-4 focus:py-2.5 focus:text-primary-fg"
    >
      Skip to content
    </a>
  );
}
