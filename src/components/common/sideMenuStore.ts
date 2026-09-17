import { create } from "zustand";

/**
 * Open/closed state of the APP-LEVEL side menu — the layer pushed pages (sketch,
 * visited collection, scoped Activity) open through the workspace mark.
 *
 * Top-level pages keep Home's own drawer (hamburger + edge swipe). A pushed page
 * sits above Home on the root stack and cannot reach that drawer, so the same
 * SideNav content is also hosted once above the whole stack (App.tsx). Opening
 * it never moves the page beneath: close it and you are exactly where you were.
 */
type SideMenuState = {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

export const useSideMenuStore = create<SideMenuState>((set) => ({
  open: false,
  openMenu: () => set({ open: true }),
  closeMenu: () => set({ open: false }),
}));
