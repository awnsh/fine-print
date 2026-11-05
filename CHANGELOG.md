# Changelog

## v0.1.0 (2026-11-05)

First release of Fine Print: a free Chrome extension that reads Terms of Service, privacy policies and EULAs for you.

### Features

- **Reads quietly in the background.** Nothing pops up on pages. On a policy page, the toolbar icon shows how many issues were found, coloured by risk. Click the icon to see the details.
- **One-sentence summary** of the worst part, in a tone you choose: Polite, Dry, Snarky, Savage or Unhinged.
- **Up to five red flags, each quoting the real sentence** from the page: data selling and sharing, forced arbitration, class-action and jury waivers, auto-renewal, no refunds, deletion at will, licenses to your uploads, tracking, sensitive data, AI training on your content, terms changes, data retention and liability limits.
- **Show in page** scrolls to the exact sentence and highlights it.
- **Before you sign up.** On a sign-up form with a terms link, the icon gets a small dot and the popup offers to summarize those terms.
- **Free, private AI.** Uses Chrome's built-in on-device model (Gemini Nano) when your computer supports it, and a built-in rules engine when it doesn't. No account, no API key, nothing sent to a server.
- **History** of the last 20 policies you've read, plus saved summaries so a policy isn't read twice.
- Light and dark mode.

### Install

1. Download `fine-print-v0.1.0.zip` below and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Optional: in Fine Print's settings, click **Download model** to turn on the on-device AI (a one-time download of about 2 GB, handled by Chrome).
