// Renders src/og.html to static/og.png (1200x630), the social preview image.
// Not part of the site build: run it by hand after changing src/og.html.
// Needs Playwright and a Chromium, e.g. `npx playwright install chromium`.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + path.join(root, 'src/og.html'));
await page.screenshot({ path: path.join(root, 'static/og.png') });
await browser.close();
console.log('Wrote static/og.png');
