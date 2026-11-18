# Parked: 3D device scenes

TresJS device mockups (MacBook, iPhone) from the earlier device-showcase flow. They are not
routed in the MVP. Cycle 3 of `docs/PLAN.md` brings them back as a `device` layout driven by the
composition: `SceneStage.vue` hosts a preset from `presets/`, built with the `kit/` components
(`<Device>`, `<SceneCamera>`, `useTrack`, …) and timed through `settings.ts`.