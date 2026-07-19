# Sharing & Received — Architecture Plan

_Drafted 2026-07-18, from design discussion. Status: **agreed direction, not yet built.**_
_Companion effort: the web transfer service (separate branch) — see [Wire contract](#3-the-wire-contract) for what both sides must agree on before that branch hardens._

## 0. The problem

Two different acts hide under "import" today, and the app conflates them:

1. **Bringing in your own material** (voice memos, DAW bounces, backups) → belongs in *your* workspaces; the existing choose-a-destination flow is correct for it.
2. **Receiving someone else's work** (a setlist to learn, a friend's songbook, a producer's stems, a transfer-link package) → is *reference material, not your creative work*. Today it lands as a new workspace in your workspace list, indistinguishable from your own — and a first-run user who clicked a share link has no workspaces to choose from at all.

Guiding principle for all receiving: **zero-decision receipt.** Receiving never asks a question. Things land somewhere safe and intact; organizing is optional and later. (Same philosophy as the Shelf: keep first, file later.)

## 1. The model — three shelves, three axes

Every sharing scenario decomposes along three independent axes:

| Axis | Values |
|---|---|
| **Origin** | mine · given to me · co-owned |
| **Granularity** | clip · collection · workspace · setlist · songbook · loose files |
| **Liveness** | **snapshot** (a copy, frozen at send time) · **synced** (live, changes flow both ways) |

Which yields three shelves:

- **My workspaces** — personal creative work. Exists today; unchanged.
- **Received** — *packages*: snapshots people sent you (or you beamed to yourself), at any granularity. New top-level drawer surface (like Shelf). NOT in the workspace picker.
- **Shared workspaces** *(future, R4)* — co-owned live spaces (accounts + cloud sync). You don't receive one; you're **invited into** one. These DO appear in the workspace picker, under a Personal / Shared split.

### The hard wall: snapshot ≠ synced

The transfer service and all file sharing deal in **snapshots**. Collaboration is **membership**. Never model one as the other — a received workspace must never be expected to stay current with its sender ("I sent Ben the fix, why is his stale?"). The escalation path from one to the other is a deliberate act: a received workspace can later be adopted, and (post-R4) the recipient can "invite the sender back in," converting a snapshot relationship into a membership one — with an explicit invitation, never automatically.

### Decided against (with reasons)

- **One general "received" workspace** as a dump target → recreates the blending problem one level down; after three months it's a pile with no provenance. Packages preserve "From Ben · Tuesday · Spring Show stems" forever.
- **Received as a tab in the workspace picker** → the picker answers "where do I create?"; the recorder must never accidentally target a bandmate's stems. Received is a drawer surface. (The picker tab split is reserved for Personal / Shared in R4.)
- **Modeling shared workspaces as an extension of receiving** → see the hard wall above.

## 2. The package

A package = one transfer event, kept together forever. Under the hood it is **workspace-shaped** (so every existing mechanism — collection views, players, practice tools, setlist resolution, moving/copying — works for free) but flagged so it never appears among your workspaces:

```ts
// On Workspace (all optional; absent = "personal" — no migration):
origin?: "personal" | "received" | "shared";
received?: {
  senderName: string | null;
  senderUserId: string | null;   // reserved; filled once accounts exist
  transferId: string | null;     // dedupe on link re-download
  receivedAt: number;
  shareKind: ShareKind;          // what the sender said this is (see §3)
  shareTitle: string;
};
```

Where each granularity lands:

| Received thing | Landing | Exit paths |
|---|---|---|
| Clip | one-item package | play · Shelf · "Add to my library" (destination chooser, at the moment they care) |
| Collection | package presenting as a collection | adopt whole into a workspace |
| Workspace | workspace-shaped package | leave as reference · adopt as personal workspace · (R4) invite sender → shared |
| Setlist / Songbook | Library entities as today; **backing songs live in the received package**, not the workspace list | as today |
| Loose files | plain files package | per-file add-to-library |

**Self-send** (desktop → phone, the DAW bridge): same pipeline; the import card's secondary action "Add to my library instead…" routes kind-appropriate content into the existing destination chooser. Post-accounts, exact self-detection can auto-offer that route.

**Adoption semantics**: copy-then-optionally-remove-package (preserves the package as-received; open question #2 below).

## 3. The wire contract

Three things the transfer-service branch and the app must agree on **before either hardens**:

### 3a. The manifest `share` block (the type authority)

Today an archive's kind is *inferred* (non-empty `manifest.setlists` → "a setlist"), which collides: a full library export also carries setlists/songbooks, and a collection share vs. a setlist share are only distinguishable by side effects. Fix: every share flow **declares intent at export**:

```ts
// manifest.json gains:
share?: {
  kind: "setlist" | "songbook" | "collection" | "workspace" | "clips" | "library";
  title: string;
  sender: { name: string | null; userId: string | null };
  transferId: string | null;
  createdAt: number;
  appVersion: string;
};
```

Receiver decision tree (extension is a hint; the manifest is the authority):

1. Extension/mime says "maybe ours" → open the zip.
2. No manifest → not a SongNook file → loose-files package (or audio self-import flow).
3. Backup format (`detectPickedArchiveKind`) → redirect to Restore (exists).
4. `share.kind` present → the truth; present accordingly. A self-sent collection can never masquerade as a setlist.
5. No `share` block (older archives) → today's inference as fallback.

### 3b. The `.songnook` file identity

Register a real `.songnook` extension with an iOS UTI declaration + Android intent filter (same native rebuild as the pending zip mime filters). Branding ("this is a SongNook file" in Messages) + deterministic share-intent routing instead of "any zip might be ours". Exports keep zip internals; only the identity changes.

### 3c. Links & identity

- Transfer links are **universal/app links**; install-then-open preserves transfer context (**deferred deep link**) so a first-run user lands directly on the received package — the onboarding funnel.
- The transfer's server manifest lists items (a transfer can mix `.songnook` files and raw audio); each item is typed by the tree above; the whole transfer is still ONE package.
- **Identity now vs. later**: v1 = sender-typed display name on the web page (friendly-sharing trust level, like an email From line). The `userId` slot is reserved from day one; accounts (needed for Pro anyway) later fill it → verified senders, sender grouping, exact self-send detection. No schema change at that point.

## 4. Roadmap

### R1 — the Received foundation (buildable now, no backend)
1. `workspace.origin` + `received` provenance block (types + normalizers; default personal; no migration).
2. **One visibility choke point**: a single helper answering "which workspaces does this surface see?" — Search, Revisit, Activity, Shelf, workspace picker, recorder targeting, collection browse all route through it. This is the single biggest rewiring-pain preventer; today "all workspaces" implicitly means "all mine" everywhere. Received is excluded by default everywhere except the Received surface (search may later gain an "include received" toggle).
3. **Received drawer page**: package list w/ provenance ("From Ben · Tuesday · 4 items"), package view rendered by existing collection/idea machinery, adopt/add-to-library actions, delete package.
4. Reroute receiving flows into packages: archive imports (share-intent + Settings) create received-flagged workspaces instead of personal ones; setlist/songbook imports keep creating Library entities but their backing songs land in the package.
5. Manifest `share` block stamped by all export flows; receiver switch on it.
6. `.songnook` UTI/extension + zip mimes in one native rebuild.
7. Mockup-first, as usual: Received page, package views (clip/collection/workspace presentations), first-run link landing.

### R2 — transfer service integration (pairs with the web branch)
Universal links + deferred deep link; transferId dedupe; sender display names; mixed-item transfers as single packages.

**Sent links (the outbox).** Creating a link stores a local record so it's never lost:

- Store: small persisted satellite (`useSentLinksStore`, shelf pattern), keyed by `transferId`: `{transferId, shareUrl, title, shareKind, entityId?, createdAt, expiresAt, itemCount}`. Local-only in v1; in R3 the server's "my transfers" becomes the source of truth and this becomes its cache (gaining revoke) — a merge, not a migration, because the key is already `transferId`.
- **Two homes**: (1) PRIMARY — an on-entity link chip in setlist/songbook/collection detail views — "Link active · 12 days left · Copy", dated (a link is a SNAPSHOT; if the entity changed since, the gesture is "New link") — powered by the `entityId` back-reference; (2) a humble central list under **Settings → Sharing** in v1, migrating to the **user profile ("My transfers", server-backed, revoke)** once accounts exist in R3. Rejected: a notifications-style dropdown (new chrome primitive, frames possessions as events) and a section on the Received page (unneeded weight — the on-entity chip carries the frequent case).
- **Self-cleaning by design**: entries mirror server expiry — countdown shown, expired entries grey out and auto-prune after a grace window. Like the Shelf, it structurally cannot become a graveyard.

### R3 — accounts (driven by Pro)
Verified senders; "from you" packages auto-offer the library route; sender grouping in Received.

### R4 — shared workspaces (the big one; separate infrastructure project)
Membership, invitations, cloud sync (server authority / op-log — design then), Personal/Shared split in the workspace picker, "invite sender into this package" escalation. Nothing in R1–R3 needs to know how sync works; the protecting disciplines already exist (globally unique ids, clean import remapping) plus what R1 adds (origin awareness, one visibility choke point, identity slots).

## 5. Open questions (decide during R1 mockups)

1. **Visual accent for received content** — a distinct tint/badge so "not mine" stays legible deep inside a package?
2. **Adopt = move or copy?** Leaning copy-then-optionally-delete-package.
3. Received setlists/songbooks: land in Library tabs with backing songs in the package (current assumption), or present package-first?
4. Package retention: keep forever, or offer "clear old packages" housekeeping?
5. Naming of the surface: "Received" (working name) vs. "Shared with you" vs. something in the archive voice.
