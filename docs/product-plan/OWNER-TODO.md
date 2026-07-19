# Owner TODO — account-bound launch steps & device verification

## 0. Device verification

The full, consolidated "does it work on a phone" pass — everything since Phase 0,
prioritized by stakes — lives in its own doc:

**→ [device-verification-checklist.md](device-verification-checklist.md)**

Start there after rebuilding the dev client (`npm run android`). The rest of THIS
file is the account/credential work only you can do.

---

Things only the account owner can do. None of these block Phases 2–4 (code work continues without them), but **items 1 and 3 gate Phase 1 (iOS) and Phase 5 (store submission)** — knock them out when convenient, the earlier the better since some have approval lead time.

## 1. Developer accounts (longest lead time — start first)
- [ ] **Apple Developer Program** — developer.apple.com, $99/year. Enrollment approval can take 1–2 days. Needed for: any iOS device build, TestFlight, App Store submission (Phases 1 & 5).
- [ ] **Google Play Console** — play.google.com/console, $25 one-time. New personal accounts require a closed-testing period (14 days, 12+ testers) before production access — check current policy early, this can affect the launch timeline. Needed for Phase 5.

## 2. Link the repo to EAS (5 minutes)
```
npm install -g eas-cli    # or use npx eas-cli
eas login                 # your Expo account (create one at expo.dev if needed)
eas init                  # writes extra.eas.projectId into app.json — commit that change
```
Build profiles already exist in `eas.json`. After this, `eas build --profile production --platform android` should work end to end.

## 3. Host the privacy policy (10 minutes)
- [ ] The policy is written: `docs/privacy-policy.md`.
- [ ] Enable **GitHub Pages** on the repo: GitHub → Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/docs`.
- [ ] Note the resulting URL (e.g. `https://bmo890.github.io/song-nook/privacy-policy`). Both store listings require it (Phase 5).
- [ ] Tell Claude the URL — a "Privacy policy" link row gets added to Settings → About pointing at it.
- Alternative if you prefer: any static host (Netlify, Cloudflare Pages) — only the stable URL matters.

## 4. When Phase 1 (iOS) starts — hardware & signing
- [ ] A Mac with Xcode installed (current stable) + a physical iPhone with a cable.
- [ ] After the Apple account exists: `eas credentials` (or let `eas build --platform ios` walk you through it) to generate signing certs — EAS manages the share-extension provisioning automatically.

## 5. SongNook housekeeping (non-blocking, whenever)
- [ ] Register a domain if wanted (songnook.app / songnook.com) — nice for the store listing's marketing URL and a future landing page; not required to ship.
- [ ] Sanity search "SongNook" on the App Store / Play Store / USPTO (Classes 9 & 41) before first submission — the name was locked without a formal clearance pass; a 30-minute check de-risks it. (See phase-0.0 ticket, Step 1.)
- [ ] Rename the GitHub repo `song-nook` → `songnook` if desired (GitHub auto-redirects old remotes; run `git remote set-url` afterward). Cosmetic only.

## Already handled (no action)
- eas.json build profiles · privacy policy text · export-compliance key · app icon first pass (refine art whenever — replace the four PNGs in `assets/`) · bundle ID decision (keeping `com.bmostudio.songnook`).
