// Renders the any-table/anytable Markdown files into a static site in public/.
// build.sh fetches the source into content/ first; set ANYTABLE_DIR to build
// from a local checkout instead.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';

const SRC = process.env.ANYTABLE_DIR || 'content';
const OUT = 'public';
const SITE = 'https://anytable.org';
const REPO = 'https://github.com/any-table/anytable';

const HOME_DESCRIPTION =
  'any table is a belief system that claims no revelation, owns no buildings, takes no collection, ' +
  'and belongs to no one. A daily sitting, a weekly shared meal at any table, and a text anyone may copy or change.';

// Source file -> URL path. Order is the order of the site navigation.
// Pages whose file is missing from the published ref (e.g. a file added after
// the latest tag) are left out rather than failing the build.
const PAGES = [
  { file: 'CARD.md', slug: '', nav: 'The card', required: true, description: HOME_DESCRIPTION },
  { file: 'FOUNDATIONAL.md', slug: 'foundational', nav: 'Full text', required: true, toc: true },
  { file: 'READING.md', slug: 'reading', nav: 'Reading' },
  { file: 'CHANGELOG.md', slug: 'changelog', nav: 'Changelog' },
  { file: 'CONTRIBUTING.md', slug: 'contributing', nav: 'Contributing' },
  { file: 'GOVERNANCE.md', slug: 'governance', nav: 'Governance' },
  { file: 'NOTICE.md', slug: 'license', nav: 'License', appendPlain: 'LICENSE' },
];

const OG_IMAGE = { path: '/og.png', width: 1200, height: 630, alt: 'any table: what we know, we hold with an open hand. What we love, we hold with both.' };

const urlFor = (slug) => (slug ? `/${slug}/` : '/');

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

function fail(message) {
  console.error(`build: ${message}`);
  process.exit(1);
}

function git(...args) {
  try {
    return execFileSync('git', ['-C', SRC, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// --- Source ----------------------------------------------------------------

for (const p of PAGES.filter((p) => p.required)) {
  if (!fs.existsSync(path.join(SRC, p.file))) fail(`no ${p.file} in ${SRC}/. Run ./build.sh, or set ANYTABLE_DIR.`);
}

const pages = PAGES.filter((p) => {
  const present = fs.existsSync(path.join(SRC, p.file));
  if (!present) console.warn(`build: ${p.file} not in this ref; skipping /${p.slug}/`);
  return present;
});
const pageByFile = new Map(pages.map((p) => [p.file, p]));
const hasLicensePage = pageByFile.has('NOTICE.md');

const sha = git('rev-parse', 'HEAD');
const tag = git('describe', '--tags', '--exact-match');
const commitDate = git('log', '-1', '--format=%cs');

// The text's version, read from the H1 ("# Foundational Document (0.2.0)") and
// the "**Version.** 0.2.0, ..." line. The two must agree, and when building
// from a version tag they must match it, so the site never labels one
// revision with another's number.
function textVersion(markdown) {
  const semver = String.raw`(\d+\.\d+\.\d+)`;
  const h1 = markdown.split('\n').find((line) => /^#\s/.test(line)) ?? '';
  const fromHeading = new RegExp(String.raw`\(${semver}\)\s*$`).exec(h1)?.[1];
  const fromLine = new RegExp(String.raw`^\*\*Version\.\*\*\s+${semver}(?=[,.\s])`, 'm').exec(markdown)?.[1];

  if (fromHeading && fromLine && fromHeading !== fromLine) {
    fail(`FOUNDATIONAL.md heading says ${fromHeading} but its Version line says ${fromLine}.`);
  }
  const version = fromHeading || fromLine || '';
  const tagVersion = /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1];
  if (tagVersion && version !== tagVersion) {
    fail(`tag ${tag} does not match the version in FOUNDATIONAL.md (${version || 'none found'}).`);
  }
  if (!version) console.warn('build: no version found in FOUNDATIONAL.md');
  return version;
}

const version = textVersion(fs.readFileSync(path.join(SRC, 'FOUNDATIONAL.md'), 'utf8'));

// --- Rendering -------------------------------------------------------------

// Links to other repo files ("CARD.md", "./READING.md#x") point at their site page.
function rewriteHref(href) {
  const m = /^(?:\.\/)?([A-Z]+(?:\.md)?)(#.*)?$/.exec(href);
  const page = m && pageByFile.get(m[1]);
  if (page) return urlFor(page.slug) + (m[2] || '');
  if (m && m[1] === 'LICENSE' && hasLicensePage) return urlFor('license') + '#cc0';
  return href;
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
        const code = `<code>${escapeHtml(text)}</code>`;
        const href = rewriteHref(text);
        return href !== text ? `<a href="${href}">${code}</a>` : code;
      },
    },
  });
  const html = marked.parse(markdown);
  return { html, headings };
}

const layout = fs.readFileSync('src/layout.html', 'utf8');

function headMeta({ title, description, slug }) {
  // Pages that are not real addresses (the 404) get no canonical URL and stay out of search.
  if (slug === null) return '<meta name="robots" content="noindex">';
  const url = SITE + urlFor(slug);
  return [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="any table">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}${OG_IMAGE.path}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n  ');
}

function page({ title, description, slug, body, meta }) {
  const nav = pages
    .map((p) => {
      const current = p.slug === slug ? ' aria-current="page"' : '';
      return `<a href="${urlFor(p.slug)}"${current}>${p.nav}</a>`;
    })
    .join('\n        ');
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const vars = { title: t, description: d, head: headMeta({ title: t, description: d, slug }), nav, body, meta };
  return layout.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function firstParagraph(markdown) {
  const para = markdown
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .find((s) => s && !s.startsWith('#') && !s.startsWith('<!--'));
  return (para || '').replace(/\s+/g, ' ').replace(/[*_`[\]]/g, '').replace(/\(https?:[^)]+\)/g, '').slice(0, 200);
}

// --- Build -----------------------------------------------------------------

const source = sha
  ? `from <a href="${REPO}/tree/${sha}"><code>${tag ? escapeHtml(tag) + ' · ' : ''}${sha.slice(0, 7)}</code></a>`
  : `from <a href="${REPO}">any-table/anytable</a>`;
const meta = `${version ? `Text version ${version}, built ` : 'Built '}${source}.`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync('static', OUT, { recursive: true });
fs.copyFileSync('src/style.css', path.join(OUT, 'style.css'));

for (const p of pages) {
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

  if (p.appendPlain && fs.existsSync(path.join(SRC, p.appendPlain))) {
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
    page({ title, description: p.description ?? firstParagraph(markdown), slug: p.slug, body: html, meta }),
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

const lastmod = commitDate ? `<lastmod>${commitDate}</lastmod>` : '';
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((p) => `  <url><loc>${SITE}${urlFor(p.slug)}</loc>${lastmod}</url>\n`).join('') +
    '</urlset>\n',
);

console.log(`Built ${pages.length} pages into ${OUT}/ (${meta.replace(/<[^>]+>/g, '')})`);
