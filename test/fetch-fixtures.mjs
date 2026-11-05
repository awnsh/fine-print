// Downloads real Terms pages into test/fixtures/ for local testing.
// They're the sites' own text, so they're git-ignored rather than committed.
//   npm run test:fixtures
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const pages = [
  'https://redditinc.com/policies/user-agreement',
  'https://discord.com/terms',
  'https://www.spotify.com/us/legal/end-user-agreement/',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

await mkdir(dir, { recursive: true });
for (const url of pages) {
  const name = url.replace(/^https:\/\//, '').replace(/[/.]/g, '_');
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(join(dir, `${name}.html`), await res.text());
    console.log(`saved ${name}`);
  } catch (e) {
    console.warn(`skipped ${url}: ${e instanceof Error ? e.message : e}`);
  }
}
