// Serves saved policy pages with the fake-chrome harness + the real content.js injected.
//   node test/serve.mjs            -> http://localhost:5178/
//   /terms/<fixture-name>          -> fixture page (URL contains "terms" so detection runs)
//   /page/<fixture-name>           -> same, under a neutral URL (e.g. the sign-up page)
//   /ext/popup/index.html          -> built popup/options pages on the fake chrome API
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 5178);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  try {
    if (url.pathname === '/harness.js' || url.pathname === '/content.js') {
      const file = url.pathname === '/harness.js' ? join(root, 'dist', 'harness.js') : join(root, '..', 'dist', 'content.js');
      res.writeHead(200, { 'content-type': 'text/javascript' }).end(await readFile(file));
      return;
    }
    // Built extension pages (popup, options), with the fake chrome API loaded first.
    const ext = url.pathname.match(/^\/ext\/([\w./-]+)$/);
    if (ext && !ext[1].includes('..')) {
      const file = join(root, '..', 'dist', ext[1]);
      const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', png: 'image/png', json: 'application/json' };
      const type = types[file.split('.').pop()] ?? 'application/octet-stream';
      let body = await readFile(file);
      if (type.startsWith('text/html')) body = String(body).replace('<head>', '<head><script src="/harness.js"></script>');
      res.writeHead(200, { 'content-type': type }).end(body);
      return;
    }
    const m = url.pathname.match(/^\/(?:terms|page)\/([\w.-]+)$/);
    if (m) {
      let html = await readFile(join(root, 'fixtures', `${m[1]}.html`), 'utf8');
      // Drop the site's own scripts and CSP so only our code runs.
      html = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '');
      const inject = `<script src="http://localhost:${port}/harness.js"></script><script src="http://localhost:${port}/content.js"></script>`;
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${inject}</body>`) : html + inject;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
      return;
    }
    const names = (await readdir(join(root, 'fixtures'))).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
    res
      .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      .end(`<h1>Fine Print fixtures</h1><ul>${names.map((n) => `<li><a href="/terms/${n}">${n}</a></li>`).join('')}</ul>`);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(port, () => console.log(`Fine Print test server on http://localhost:${port}`));
