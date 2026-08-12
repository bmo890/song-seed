# Positioning — the two verticals, and what to call this

**Written:** 2026-08-12 · Companion to [competitive-landscape.md](competitive-landscape.md)
(especially §11) and input to [store-listing.md](store-listing.md) and Phase 4 first-run.

---

## 0. The question

SongNook serves two audiences that are usually the same person at different moments:

- **The writer** — catch a hum, grow it: clips, takes, overdubs, lyrics with versions, chords, word tools, clip lineage.
- **The player** — get material ready to perform: loops, slow-down, pitch shift, pins and sections, tempo detection, metronome, tuner, setlists, songbooks, chord charts.

Has serving the second one hurt the app? And how do we describe something this wide
without either drowning people in features or shrinking to "another voice memo app"?

## 1. The answer: it hurt the pitch, not the product

**Keep the second vertical. It is not a distraction — it is the part that makes the
app a habit.**

The problem named in competitive-landscape §11 is that songwriting has **no external
trigger.** Nobody sends you a link. No deadline says "write today." Inspiration is
unscheduled, which is a brutal retention problem — it's why capture apps have huge
install numbers and terrible weekly actives.

**Gigs have dates.** A setlist for Friday, a song to learn by Tuesday, a rehearsal
tomorrow — these are hard, calendared reasons to open an app. The performance vertical
is the closest thing SongNook has to [untitled]'s "someone sent me a link" trigger.
Cutting it to sharpen the story would sharpen the story and gut the habit.

There's a second, better reason: **they are one arc, not two products.** A song goes
hum → sketch → take → words → chart → *known cold* → played. The practice tools are
not a separate app bolted on; they are the last third of the same journey. The only
reason it *feels* like two products is that we've been describing the first third.

So the real diagnosis is narrower than "we serve two verticals":

> **We built the whole arc and market only its beginning.**

That's a copy problem and an IA-emphasis problem. It is not a roadmap problem.

## 2. Why "Catch song ideas, grow them" undersells — you're right

Two failures, and the second is the expensive one:

1. **It describes the first 20% of the product.** Everything that makes us hard to replace — lyric versions, practice suite, setlists, songbooks — lives past the word "grow."
2. **It files us in the wrong category.** "Catch song ideas" is the voice-memo category, which is crowded, free, and pre-installed on every phone. Category is the single highest-leverage marketing decision, because it determines who we're compared to. In the voice-memo category we're a nicer Voice Memos. In our own category we're the only one.

The fix is **not** a longer sentence or a feature list. It's claiming a different
category.

## 3. The category claim

Look at what every adjacent app actually holds:

| Product | Holds |
|---|---|
| Voice Memos / capture apps | the **moment** an idea arrives, then nothing |
| DAWs / BandLab | the **production** of a finished recording |
| [untitled] / Samply | the **file**, after it exists |
| Setlist & chord apps | the **performance**, with no audio and no creation |
| **SongNook** | **the whole life of a song, from hum to stage** |

Nobody else holds a song across time. That is the claim, and it's defensible because
it's *structurally* true — the others' business models actively prevent it. [untitled]
will never build lyric versioning; a setlist app will never hold your unfinished takes.

**The pitch is continuity, not capture.**

Useful internal one-liner: *every other app holds one moment of a song — SongNook
holds all of them.*

## 4. The language

The rule from §11 was misstated as "one short sentence." The correct rule is: **a
stranger must be able to hold it after hearing it once.** That permits something much
bigger than "catch song ideas" — it just has to be *one shape*, not a list.

The shape that works for both verticals is a **verb triad** — the user's own actions,
in order, spanning the arc:

> ### Write it. Learn it. Play it.

Why this one:
- Names **both** verticals explicitly, in the user's language, without the words "features" or "tools."
- The word **"Learn"** does enormous work: it implies loops, slow-down, pitch shift, and repetition without listing any of them, and it's the half nobody else has.
- It implies **time and return** — three stages means the app is somewhere you come back to, which is exactly what "catch an idea" fails to say.
- It sets up the depth story: *"and it keeps every version along the way."*
- It survives translation and RTL, and it fits the app's voice — terse, no marketing adjectives, label-don't-narrate.

**Store fields (candidates, character counts for the 30-char App Store subtitle):**

| Field | Recommended | Alternates |
|---|---|---|
| Subtitle (30) | `Write it. Learn it. Play it.` (28) | `From first hum to the gig` (25) · `Write, practise, perform` (24) |
| Play short (80) | `Write songs, learn them cold, and play them. Every version kept, all offline.` (77) | — |
| Promo text (170) | `Most apps hold one moment of a song. SongNook holds all of them — the first hum, every lyric version, the take you practise at 70%, the setlist on Friday. All on your device.` (169) | — |

The description body then earns the claim with the three-act structure below, rather
than the current "catch the spark" framing.

## 5. Restructure the pitch as three acts

The current store description leads with capture and buries the differentiators. Lead
with the arc instead — same content, resequenced so the unique half isn't in the
basement:

1. **WRITE IT** — record the hum; grow it into a sketch; lyrics that keep every version; chords; word tools when a line won't come.
2. **LEARN IT** — loop the hard bar, slow it down, shift the pitch without touching the recording, mark the sections, count yourself in.
3. **PLAY IT** — setlists, songbooks, chord charts you can read on a stand.
4. **AND IT'S YOURS** — no account, no cloud, nothing uploaded, ever.

Act 2 is the one no competitor has and the one currently invisible in our marketing.
Act 4 is the closer, not the opener — it's what makes people *trust* us, but it's not
what makes them *download*.

## 6. Two audiences, two jobs — use the split deliberately

Don't split the *message*. Split the *funnel*.

**Acquire on the player's problems. Retain and deepen on the writer's.**

The reasoning: the performance vertical has sharper, dated, problem-aware demand.
People search "slow down music," "setlist app," "chord chart," "metronome," "looper"
when they have a gig on Friday — high intent, specific, urgent. "Songwriting app" is
browsing behaviour by comparison. But the *writer* is who stays, because that's where
identity and accumulated library live.

Practical implications:
- **Keywords** currently lead with songwriting terms. Worth testing a rebalance toward practice/performance intent (`looper`, `slow down`, `setlist`, `metronome`, `chord chart`, `transpose`) — these describe acute needs, and the writing tools are the pleasant surprise after install.
- **Screenshots** should show the arc, not the capture. Shot 1 is currently "recording in progress"; a stronger opener is the practice panel or a setlist, because it says *this is not a voice memo app* in one glance.
- **Seeding** (competitive-landscape §10) points the same way: songwriting teachers, worship leaders, and gigging musicians all live at the intersection and feel both pains.

Flagging the uncertainty honestly: this is a **hypothesis about search demand, not a
measured fact** — I have no ASO data. It's cheap to test post-launch by rotating
keywords and watching impressions, and Phase 5 should treat the keyword line as a
variable, not a decision.

## 7. What I'd change in the existing plan

- `store-listing.md` subtitle → `Write it. Learn it. Play it.` (from `Catch song ideas, grow them`)
- Description body → the three-act structure in §5, privacy as the closer
- Screenshot order → lead with practice or setlist, not recording
- Keywords → test a practice/performance-weighted variant
- Phase 4 first-run → the three acts are also the right onboarding spine: show the user that the app spans write → learn → play, or they'll file us as a recorder on day one and never find act 2

## 8. The one thing to hold onto

The breadth is only a liability while it's described as a list. Described as an **arc**
it becomes the moat: we are the only place a song can live for its entire life, and
the reason nobody else does it is that their business models can't. Say the arc, and
the feature depth stops looking scattered and starts looking like evidence.
