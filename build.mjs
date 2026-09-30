// Renders the any-table/anytable Markdown files into a static site in public/.
// build.sh fetches the source into content/ first; set ANYTABLE_DIR to build
// from a local checkout instead.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';

const SRC = process.env.ANYTABLE_DIR || 'content';
const OUT = 'public';
const REPO = 'https://github.com/any-table/anytable';

// Source file -> URL path. Order is the order of the site navigation.
const PAGES = [
  { file: 'CARD.md', slug: '', nav: 'The card' },
  { file: 'FOUNDATIONAL.md', slug: 'foundational', nav: 'Full text', toc: true },
  { file: 'READING.md', slug: 'reading', nav: 'Reading' },
  { file: 'CHANGELOG.md', slug: 'changelog', nav: 'Changelog' },
  { file: 'CONTRIBUTING.md', slug: 'contributing', nav: 'Contributing' },
  { file: 'NOTICE.md', slug: 'license', nav: 'License', appendPlain: 'LICENSE' },
];

const urlFor = (slug) => (slug ? `/${slug}/` : '/');
const pageByFile = new Map(PAGES.map((p) => [p.file, p]));

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

// Links to other repo files ("CARD.md", "./READING.md#x") point at their site page.
function rewriteHref(href) {
  const m = /^(?:\.\/)?([A-Z]+(?:\.md)?)(#.*)?$/.exec(href);
  const page = m && pageByFile.get(m[1]);
  if (page) return urlFor(page.slug) + (m[2] || '');
  if (m && m[1] === 'LICENSE') return urlFor('license') + '#cc0';
  return href;
}

function git(...args) {
  try {
    return execFileSync('git', ['-C', SRC, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function render(markdown) {
  const used = new Map();
  const headings = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text) || 'section';
        const n = used.get(id) || 0;
        used.set(id, n + 1);
        if (n) id += `-${n}`;
        headings.push({ depth, id, html: inner });
        if (depth === 1) return `<h1 id="${id}">${inner}</h1>\n`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(rewriteHref(href))}"${t}>${inner}</a>`;
      },
      codespan({ text }) {
        const page = pageByFile.get(text);
        const code = `<code>${escapeHtml(text)}</code>`;
        if (page) return `<a href="${urlFor(page.slug)}">${code}</a>`;
        if (text === 'LICENSE') return `<a href="${urlFor('license')}#cc0">${code}</a>`;
        return code;
      },
    },
  });
  const html = marked.parse(markdown);
  return { html, headings };
}

const layout = fs.readFileSync('src/layout.html', 'utf8');

function page({ title, description, slug, body, meta }) {
  const nav = PAGES.map((p) => {
    const current = p.slug === slug ? ' aria-current="page"' : '';
    return `<a href="${urlFor(p.slug)}"${current}>${p.nav}</a>`;
  }).join('\n        ');
  const vars = {
    title: escapeHtml(title),
    description: escapeHtml(description),
    canonical: `https://anytable.org${urlFor(slug ?? '')}`,
    nav,
    body,
    meta,
  };
  return layout.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function firstParagraph(markdown) {
  const para = markdown
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .find((s) => s && !s.startsWith('#'));
  return (para || '').replace(/[*_`[\]]/g, '').replace(/\(https?:[^)]+\)/g, '').slice(0, 200);
}

// --- Build ---------------------------------------------------------------

if (!fs.existsSync(path.join(SRC, 'FOUNDATIONAL.md'))) {
  console.error(`No FOUNDATIONAL.md in ${SRC}/. Run ./build.sh, or set ANYTABLE_DIR.`);
  process.exit(1);
}

const foundational = fs.readFileSync(path.join(SRC, 'FOUNDATIONAL.md'), 'utf8');
const version = /\((\d+\.\d+\.\d+)\)/.exec(foundational)?.[1] ?? '';
const sha = git('rev-parse', 'HEAD');
const tag = git('describe', '--tags', '--exact-match');

const source = sha
  ? `from <a href="${REPO}/tree/${sha}"><code>${tag ? escapeHtml(tag) + ' · ' : ''}${sha.slice(0, 7)}</code></a>`
  : `from <a href="${REPO}">any-table/anytable</a>`;
const meta = `${version ? `Text version ${version}, built ` : 'Built '}${source}.`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync('static', OUT, { recursive: true });
fs.copyFileSync('src/style.css', path.join(OUT, 'style.css'));

for (const p of PAGES) {
  const markdown = fs.readFileSync(path.join(SRC, p.file), 'utf8');
  let { html, headings } = render(markdown);

  if (p.toc) {
    const items = headings
      .filter((h) => h.depth === 2)
      .map((h) => `<li><a href="#${h.id}">${h.html}</a></li>`)
      .join('\n');
    const toc = `<details class="toc"><summary>Contents</summary>\n<ol>\n${items}\n</ol>\n</details>\n`;
    html = html.replace(/(<\/h1>\n)/, `$1${toc}`);
  }

  if (p.appendPlain) {
    const plain = fs.readFileSync(path.join(SRC, p.appendPlain), 'utf8');
    html += `<h2 id="cc0">CC0 1.0 Universal</h2>\n<pre class="legal">${escapeHtml(plain)}</pre>\n`;
  }

  const h1 = headings.find((h) => h.depth === 1);
  const heading = h1 ? h1.html.replace(/<[^>]+>/g, '') : p.nav;
  const title = p.slug ? `${heading} · any table` : 'any table';

  const dir = path.join(OUT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    page({ title, description: firstParagraph(markdown), slug: p.slug, body: html, meta }),
  );
}

fs.writeFileSync(
  path.join(OUT, '404.html'),
  page({
    title: 'Not found · any table',
    description: 'Page not found.',
    slug: null,
    body: '<h1>Not found</h1>\n<p>There is nothing at this address. <a href="/">The card</a> is the whole thing on one page.</p>\n',
    meta,
  }),
);

console.log(`Built ${PAGES.length} pages into ${OUT}/ (${meta.replace(/<[^>]+>/g, '')})`);
