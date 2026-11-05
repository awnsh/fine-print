<p align="center">
  <img src="brand/logo-512.png" alt="Fine Print logo" width="112" height="112" />
</p>

<h1 align="center">Fine Print</h1>

<p align="center"><strong>We read the Terms so you don't have to.</strong></p>

<p align="center">
  A free Chrome extension that reads Terms of Service, privacy policies and EULAs,<br />
  sums up the worst part in one blunt sentence, and shows you exactly where it says so.
</p>

<p align="center">
  Manifest V3 &nbsp;|&nbsp; TypeScript &nbsp;|&nbsp; No account &nbsp;|&nbsp; No API key &nbsp;|&nbsp; Nothing leaves your browser
</p>

---

## What it does

- **Stays out of the way.** Nothing pops up on pages. Fine Print reads policy pages quietly and puts the number of issues on its toolbar icon, coloured by risk. Click the icon to see everything.
- **One-sentence summary.** A plain-English headline about the worst part, in the tone you pick, from polite to unhinged.
- **Up to five red flags, with receipts.** Data selling, forced arbitration, class-action waivers, auto-renewal, no refunds, deletion at will, licenses to your uploads, tracking and more. Every flag quotes the real sentence, and **Show in page** scrolls to it and highlights it.
- **Before you sign up.** On a sign-up form with a terms link, the icon gets a small dot and the popup offers to summarize those terms.
- **Free AI, on your device.** Uses Chrome's built-in Gemini Nano when the computer supports it, and its own rules when it doesn't. No paid AI, no servers.

## Install

**From a release (easiest).** Download `fine-print-vX.Y.Z.zip` from the [latest release](https://github.com/awnsh/fine-print/releases/latest) and unzip it. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the unzipped folder.

**From source.**

```bash
npm install
npm run build
```

Then load the `dist/` folder the same way. The settings page opens on first install. To use the on-device AI, click **Download model** there (a one-time download of about 2 GB, handled by Chrome).

`npm run dev` rebuilds on save; click the reload icon on the extension in `chrome://extensions` afterwards.

## Releasing

```bash
npm run package
```

builds the extension and writes `release/fine-print-v<version>.zip`, with `manifest.json` at the root, ready for **Load unpacked** or the Chrome Web Store. The version in `package.json` and `public/manifest.json` must match.

To publish a release: bump both versions, add a section to [CHANGELOG.md](CHANGELOG.md), commit, then push a tag. The [release workflow](.github/workflows/release.yml) builds the zip and attaches it to a GitHub release, using that version's CHANGELOG section as the notes.

```bash
git tag v0.2.0
git push origin v0.2.0
```

## How it works

1. **Detect.** The content script checks the URL, title and headings for Terms / Privacy / EULA hints, then makes sure the page actually contains legal text. On other pages it looks for "Sign up" / "I agree" buttons with a terms link nearby.
2. **Extract.** It reads the main content (no navigation or footer) and splits it into sentences.
3. **Summarize with on-device AI** (on by default). The service worker sends the most relevant sentences, numbered, to Chrome's Prompt API (Gemini Nano). If Chrome only exposes it to pages, an offscreen document runs it instead. The AI answers with sentence *numbers*, never its own quotes, so every red flag is a real sentence copied from the page.
4. **Rules fallback.** If the AI isn't available (older Chrome, unsupported computer, model not downloaded, or turned off), the rules in `src/lib/rules.ts` take over. "We do **not** sell your data" doesn't count as a red flag. Risk (low, some, high) comes from the weight of the flags either way.
5. **Show in page.** Finds the sentence in the page text, opens any collapsed sections, scrolls to it and highlights it with the CSS Custom Highlight API, so the page itself isn't modified. For terms linked from a sign-up page, it opens them with a text fragment link instead.
6. **Cache.** Results are stored per site and page content, so a policy isn't read twice. The popup's History tab keeps the last 20.

## Testing without installing

`test/` has a fake sign-up page and a small harness that fakes the `chrome.*` APIs and sends messages straight to the real background code.

```bash
npm run test:fixtures   # downloads a few real Terms pages into test/fixtures (git-ignored)
npm run test:serve
```

- `http://localhost:5178/terms/<fixture>`: the real `content.js` runs on a saved policy page.
- `http://localhost:5178/page/signup`: the sign-up flow.
- `http://localhost:5178/ext/popup/index.html` and `.../ext/options/index.html`: the built pages.

## Brand

The logo is a contract page with one clause highlighted, and a magnifying glass enlarging it. That's what the extension does: it finds the bad sentence and shows you where it is.

| Token | Hex | Use |
|---|---|---|
| Ink | `#1D1B24` | Icon tile |
| Paper | `#FFF5E1` | Icon page |
| Fold | `#E6D8BE` | Secondary paper |
| Text line | `#CFC4B0` | Lines in the icon |
| Red | `#FF4A3D` | Highlighted clause |
| Amber | `#FFB21E` | Magnifying glass |

The extension UI itself is neutral greys with one accent dot for risk: green `#10A37F`, amber `#D99A00`, red `#E5484D`.

## Project layout

```
fine-print/
├─ brand/              logo source + large PNG
├─ public/             manifest.json + icons
├─ src/
│  ├─ background/      service worker: on-device AI, rules fallback, cache, history, toolbar badge
│  ├─ offscreen/       runs Gemini Nano when the service worker can't
│  ├─ content/         detection, extraction, highlighting, sign-up form check (draws nothing)
│  ├─ popup/           the main screen: this page + history
│  ├─ options/         background reading, on-device AI, tone, saved data
│  └─ lib/             rules, AI prompt, storage, icons, shared types
├─ scripts/package.mjs  zips dist/ into release/ (no dependencies)
├─ .github/workflows/  release workflow: tag push builds and attaches the zip
├─ test/               fake-chrome harness, test server, fixture downloader
├─ vite.config.ts             popup / options / offscreen pages
├─ vite.background.config.ts  service worker as one file
└─ vite.content.config.ts     content script as one classic script
```
