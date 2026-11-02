# Signed over-the-air updates

Founder decision, 2026-11-02 (data-safety audit, decision D): turn on update signing
before launch. With signing on, a phone only runs an over-the-air update that carries our
signature. Someone who got into the Expo account could not push code to people's phones.

## What changes

- A private key, kept by the founder, signs every update. A certificate (public) ships
  inside the app.
- Store builds made after this is set up reject unsigned updates. Builds made before it
  (build 16, vc14 and earlier) accept both, so nothing breaks for current testers.
- Every `eas update` from then on needs `--private-key-path`. An update published
  without it would install on old builds but be refused by new ones.
- **If the private key is lost, no more over-the-air updates reach those builds.** Only
  a new store build with a new certificate fixes that. Back the key up.

## Setup (founder runs these; the key never goes in the repo or to Claude)

From the repo root:

```bash
npx expo-updates codesigning:generate --key-output-directory ~/songnook-signing/keys --certificate-output-directory certs --certificate-validity-duration-years 10 --certificate-common-name "BMO Studio"
```

```bash
npx expo-updates codesigning:configure --certificate-input-directory certs --key-input-directory ~/songnook-signing/keys
```

The second command adds `codeSigningCertificate` and `codeSigningMetadata` to
`app.json`. Commit `certs/certificate.pem` and the `app.json` change (both are public).
Then save `~/songnook-signing/keys/private-key.pem` somewhere safe outside this Mac,
such as a secure note in a password manager.

## Publishing after setup

```bash
eas update --channel preview --platform android -m "<message>" --private-key-path ~/songnook-signing/keys/private-key.pem
```

Same for `production`. The next store build after `configure` is the first that
enforces signatures.

## Status

- 2026-11-02: plan written. Waiting for the founder to run the two setup commands
  before the next store build.
