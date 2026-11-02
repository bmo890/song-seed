import { dialogStore, type DialogConfig } from "../dialogStore";

/**
 * Audit 2026-11-02, 12g G-M3: one dialog slot, newest wins, so a second dialog dropped
 * the first one's handlers. A question something waits on ("Restore your library?")
 * now keeps the slot; a later dialog waits its turn.
 */
it("a dialog that waits for its answer is never replaced; the next one follows it", () => {
    const seen: (string | null)[] = [];
    const unsubscribe = dialogStore.subscribe((config) => seen.push(config?.title ?? null));

    const question: DialogConfig = { title: "Restore your library?", buttons: [], waitsForAnswer: true };
    dialogStore.show(question);
    dialogStore.show({ title: "Clip recovered", buttons: [] });
    expect(seen[seen.length - 1]).toBe("Restore your library?");

    dialogStore.dismiss(); // answered
    expect(seen[seen.length - 1]).toBe("Clip recovered");
    dialogStore.dismiss();
    expect(seen[seen.length - 1]).toBeNull();

    // An ordinary dialog is still replaced by the next, as before.
    dialogStore.show({ title: "One", buttons: [] });
    dialogStore.show({ title: "Two", buttons: [] });
    expect(seen[seen.length - 1]).toBe("Two");
    dialogStore.dismiss();
    unsubscribe();
});
