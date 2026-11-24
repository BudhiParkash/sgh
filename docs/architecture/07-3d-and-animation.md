# 07 — Three.js Component Architecture & Animation Architecture

## 1. Principles
1. **Content first, 3D second.** No 3D scene is ever the LCP element or required to understand a page.
2. **Original assets only.** Scenes are built from procedural geometry (icosahedra, extruded shapes, instanced crystals, line grids) and a small number of original, commissioned GLB models (trophy, generic phone). No game maps, characters, weapons or logos.
3. **One canvas per page.** Multiple "scenes" on a page share a single `<Canvas>` via `drei/View`, which avoids multiple WebGL contexts (mobile browsers cap them at around 8–16 and drop old ones).
4. **Render only when visible.** `frameloop="demand"` when idle, and the canvas pauses when off-screen (IntersectionObserver) or when the tab is hidden.

## 2. Capability gating — `SceneGate` + `useRenderTier()`

```
tier = 'none' | 'low' | 'medium' | 'high'

none   ← no WebGL2/WebGL, OR prefers-reduced-motion (static poster; optional subtle CSS gradient),
         OR Save-Data header / navigator.connection.saveData, OR "Reduce effects" toggle in footer
low    ← deviceMemory ≤ 4 OR hardwareConcurrency ≤ 4 OR coarse pointer & width < 768
         → static poster on mobile; on tablet a 2D CSS-3D layered parallax instead of WebGL
medium ← tablets / mid laptops → WebGL, dpr [1, 1.5], no post-processing, ≤ 60 instances
high   ← desktop, pointer:fine, ≥ 8 cores → dpr [1, 2], bloom (selective), ≤ 300 instances
```
At runtime, `drei/PerformanceMonitor` lowers the DPR or drops to the next tier if FPS stays below about 45 for 2 seconds (`AdaptiveDpr`, `AdaptiveEvents`). The tier is computed client-side after hydration. The server always renders the poster, so there's no mismatch and no CLS.

```tsx
// pattern (illustrative)
<div className="relative aspect-[4/3] lg:aspect-[16/10]">   {/* reserved box → zero CLS */}
  <SceneFallback src="/posters/hero.avif" alt="" priority={false} />   {/* decorative */}
  <SceneGate minTier="medium" idle>                                     {/* requestIdleCallback + inView */}
    <GamingHeroSceneLazy />   {/* next/dynamic, ssr:false */}
  </SceneGate>
</div>
```

## 3. Components (`src/components/3d/`)

| Component | Where | Contents | Budget (high tier) |
|---|---|---|---|
| `GamingEnvironment` | shared | camera rig, lights (1 key directional, 1 rim, env via small HDR or `Lightformer`s), fog, background gradient plane | 3 draw calls |
| `FloatingGamingObjects` | hero | `InstancedMesh` of low-poly crystals/shards and wire rings, a `Float` drift, colours from tokens | ≤ 3 draw calls (instanced), < 20k tris |
| `GamingHeroScene` | home | Environment + FloatingObjects + an abstract "phone silhouette" made of extruded rounded-rect frames; mouse parallax (lerped camera offset ±0.3), GSAP entrance timeline | < 60k tris, < 25 draw calls, < 400 KB JS chunk (gz, incl. three) |
| `TrophyShowcase3D` | tournaments | original stylised trophy GLB (Draco, ≤ 150 KB), slow rotation, `PresentationControls` (desktop drag), contact shadow baked into a texture | < 30k tris |
| `DeviceShowcase3D` | devices / resources | generic phone GLB (no brand marks), screen as `CanvasTexture` showing UI | ≤ 200 KB model |
| `SensitivityDevice3D` | finder, config page | phone + floating `Html`/`Text` panels with the four categories; panels animate value bars on change (spring) | text via troika SDF, a single font atlas |
| `SceneFallback` | all | `next/image` poster (AVIF/WebP), the same composition as the 3D, decorative `alt=""` | ≤ 60 KB |
| `SceneGate` | all | tier + inView + idle + error boundary → fallback on context loss/error | — |

Asset pipeline: Blender → glTF → `gltf-transform` (`dedup`, `prune`, `weld`, `quantize`, `draco`, KTX2/WebP textures ≤ 1024²) → `gltfjsx --types` to generate typed components. Draco and KTX2 decoders are self-hosted from `/public/draco/`.

Memory hygiene: R3F disposes on unmount. Shared geometries and materials are created once (module-level `useMemo`) and textures go through `useTexture.preload`. `webglcontextlost` is handled so the gate swaps to the poster.

## 4. Animation architecture

| Layer | Tool | Used for |
|---|---|---|
| Micro-interactions | CSS transitions/transforms | button press, link underline, card lift, focus ring |
| Component motion | **Motion for React** (`motion/react`) | menu/sheet open, tabs, accordions, list stagger, layout animations, filter chips, finder result reveal, page transitions (`AnimatePresence` in template.tsx) |
| Timelines & scroll | **GSAP** (+ ScrollTrigger, SplitText if licensed — GSAP is free incl. plugins since 2025, verify licence at install) | hero entrance (text split + 3D camera dolly in one timeline), section reveals on desktop, pinned "how sensitivity works" explainer |
| 3D frame animation | R3F `useFrame` + `maath/easing` damp | parallax, float, value bars |
| Smooth scroll | **Lenis** — desktop pointer:fine only, disabled on touch and reduced motion; synced with ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` | |
| Illustrations | **Lottie** (`lottie-web` light/`dotlottie`) — empty states, success state on forms; lazy, ≤ 30 KB each | |

Rules
- All motion tokens (durations and easings) come from `lib/animation/tokens.ts`, shared by CSS variables, Motion and GSAP.
- `useReducedMotion()` reduces everything to opacity fades ≤ 160 ms or none. GSAP uses `gsap.matchMedia()` with a `(prefers-reduced-motion: no-preference)` branch.
- Only animate `transform` and `opacity`. Never animate layout properties on scroll.
- GSAP is registered once in a client-only provider and every timeline is created inside `useGSAP()` (automatic cleanup).
- Content must be visible without JS. Reveal animations start from `opacity: 1` on the server and are applied only after hydration (`data-animate` gated by a class added by JS), which protects SEO and LCP.

## 5. Performance budgets (enforced in CI via Lighthouse CI + bundle analyzer)
- Home route first-load JS (excluding the lazy 3D chunk): ≤ 170 KB gz.
- The 3D chunk is loaded only when the gate passes. three + R3F + drei (tree-shaken) is about 180–250 KB gz.
- LCP ≤ 2.5 s on Moto G-class emulation (4G), CLS ≤ 0.05, INP ≤ 200 ms.
