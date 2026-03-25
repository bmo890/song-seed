# Code Architecture Principles

This document defines the preferred frontend architecture for Song Seed.

It exists to keep the codebase:
- readable to a first-time contributor
- easy to redesign without large rewrites
- locally reusable without premature abstraction
- structurally consistent across `Collection`, `Song`, and the rest of the app

## Primary goals

- Thin screen entry files
- Small, explicit feature boundaries
- Local ownership before global reuse
- Fewer giant prop surfaces
- Effects split by concern
- Components that are easy to understand in isolation

## Preferred feature structure

Each major screen should use a feature folder shaped like this:

```text
FeatureScreen/
  index.tsx
  types.ts
  styles.ts

  provider/
    FeatureScreenProvider.tsx
    FeatureScreenContext.ts

  hooks/
    useFeatureData.ts
    useFeatureFilters.ts
    useFeatureSelection.ts
    useFeatureImportFlow.ts
    useFeatureManagement.ts
    useFeaturePlayback.ts
    useFeatureEffects.ts

  sectionHooks/
    useFeatureHeaderSection.ts
    useFeatureListSection.ts
    useFeatureFooterSection.ts

  sections/
    FeatureHeaderSection.tsx
    FeatureListSection.tsx
    FeatureFooterSection.tsx

  components/
    FeatureRow.tsx
    FeatureSearchRow.tsx
    FeatureBanner.tsx
    FeatureDock.tsx

  modals/
    FeatureEditModal.tsx
    FeatureActionsModal.tsx
```

Not every feature needs every folder, but this is the default target shape.

## Screen entry rule

`index.tsx` should be a shell, not a controller.

It may do:
- route wiring
- provider mounting
- top-level layout composition

It should not own:
- all derived state
- most modal state
- multiple unrelated workflows
- large effect orchestration
- broad action assembly for the whole screen

Target:
- screen entry files should usually be around `100-250` lines
- if a screen root crosses `~300` lines, it should be treated as a refactor candidate

## Provider rule

Use a feature-local provider when a screen has multiple sections that need shared screen state.

Use providers for:
- screen-scoped state
- derived state shared across multiple sections
- coordination between sections

Do not use providers for:
- app-global state that already belongs in Zustand
- trivial one-off local state

The provider should expose a clear, local contract for the feature and prevent long prop chains.

## Hook rule

Hooks should be split by concern.

Good examples:
- `useCollectionSearch`
- `useCollectionFilters`
- `useCollectionSelection`
- `useCollectionImportFlow`
- `useCollectionPlayback`
- `useCollectionEffects`

Avoid mega-hooks like:
- `useCollectionScreenModel` returning half the screen

If a hook controls more than one major concern, split it.

## Section rule

Sections should map to visible page regions.

Examples:
- header
- filters
- list/body
- footer/actions

Sections should usually:
- read from feature-local hooks or provider hooks
- render a small number of child components

Sections should not be prop-forwarding wrappers.

If a section takes a giant `model` prop and mostly passes it through, it is not a real boundary yet.

## Component rule

Components should be small and local by default.

Prefer:
- more components
- fewer responsibilities per component
- local logic colocated with the component that owns it

Do not default to giant reusable components with many configuration branches.

Promote to shared only when reuse is real.

## Prop budget rule

Use these as practical guardrails:

- Leaf UI components: usually `3-8` props
- Section components: usually `0-5` props
- More than `10` props is a design smell unless the prop is a true domain object

A large `model` prop is acceptable only when:
- the receiving component actually owns and consumes that model
- it is not just unpacking and forwarding the fields again

## Effect rule

Long `useEffect` blocks are a smell.

Each effect should own one concern.

Prefer:
- `useFocusScroll()`
- `useInlinePlayerLifecycle()`
- `useRecentHighlightAnimation()`
- `useDebouncedSearch()`

Avoid:
- one long effect that handles unrelated state sync, focus, cleanup, and UI mutation

If an effect needs paragraphs of explanation, it probably wants to become a named hook.

## Reuse and promotion rule

Default to local feature ownership.

Promote a hook/component/helper to shared only when all are true:

1. It is used in at least `2` real places
2. The behavior contract is actually the same
3. The extraction makes both call sites simpler
4. The abstraction is easier to understand than the duplicated local code

Do not extract for hypothetical future reuse.

## Zustand usage rule

Screen render components should not be full of imperative `useStore.getState()` calls.

Prefer:
- typed action adapters
- feature-local hooks that assemble actions once
- store reads through selectors near the owning logic

Use `useStore.getState()` sparingly for:
- callbacks that genuinely need it
- imperative flows that cannot be expressed cleanly otherwise

## Styles rule

Do not keep growing the giant global `src/styles.ts`.

Prefer:
- local `styles.ts` files per feature
- global design tokens for shared values
- shared primitive styles only when they are truly cross-feature

The goal is to make redesign work local, not force every style change through one global file.

## Collection and Song as templates

`Collection` and `Song` are the most logic-heavy browse/work surfaces in the app.

They must be treated as the architecture templates for the rest of the app.

If the structure is clear there, it can be repeated safely in:
- `Player`
- `Library`
- `Workspace`
- `Home`
- `Settings`

## Practical checklist

Before considering a screen “well structured,” ask:

- Can a new engineer understand the screen entry file quickly?
- Are effects split by concern?
- Are sections real boundaries, not prop-forwarding wrappers?
- Are hooks local by default and promoted only when proven?
- Are props narrow and easy to scan?
- Is state owned at the lowest sensible level?
- Could the UI be redesigned without rewriting the entire screen controller?

If the answer is “no” to multiple items, the feature still needs structural work.
