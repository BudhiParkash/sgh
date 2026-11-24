/** Motion tokens shared by CSS (globals.css), Motion and GSAP. Keep in sync with globals.css. */
export const duration = { instant: 0.1, fast: 0.16, base: 0.24, slow: 0.4, cinematic: 1.0 } as const;
export const easeOut = [0.2, 0.8, 0.2, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;
export const gsapEaseOut = "power3.out";
export const gsapEaseInOut = "power2.inOut";
