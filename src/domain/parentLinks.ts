/**
 * Parent links (a collection's parent collection, a take's "version of") must form
 * trees. Data from outside the app (an archive, a backup, an older bug) can carry a
 * loop; every walk over these links is bounded with the helpers here (data-safety
 * audit 2026-11-02, 08 R3: a loop froze Revisit and Activity until Erase).
 */

/** Bounded walk up a parent map: true when `id`'s chain comes back on itself. */
export function hasParentCycle(id: string, parentOf: ReadonlyMap<string, string | null | undefined>): boolean {
    const seen = new Set<string>([id]);
    let current = parentOf.get(id);
    while (current) {
        if (seen.has(current)) return true;
        seen.add(current);
        current = parentOf.get(current);
    }
    return false;
}

/**
 * Cut every cycle in a parent map, in place: in each loop, the one link that closes
 * it is removed (that node becomes a root, the rest hang beneath it, nothing is
 * lost). Dangling parents (not in the map) are cut too. Returns how many links were
 * cut. Linear overall: a node whose chain is known to reach a root is not walked again.
 */
export function breakParentCycles(parentOf: Map<string, string | null | undefined>): number {
    let cut = 0;
    for (const [id, parent] of parentOf) {
        if (parent && (parent === id || !parentOf.has(parent))) {
            parentOf.set(id, null);
            cut += 1;
        }
    }
    const settled = new Set<string>();
    for (const id of parentOf.keys()) {
        const path: string[] = [];
        const onPath = new Set<string>();
        let current: string | null | undefined = id;
        while (current && !onPath.has(current) && !settled.has(current)) {
            onPath.add(current);
            path.push(current);
            current = parentOf.get(current);
        }
        // The walk met itself: the link out of the last node walked closes the loop.
        if (current && onPath.has(current)) {
            parentOf.set(path[path.length - 1]!, null);
            cut += 1;
        }
        for (const node of path) settled.add(node);
    }
    return cut;
}
