# site

The website for the any table belief system, published at [anytable.org](https://anytable.org).

This repository holds only the presentation. The text itself lives in [any-table/anytable](https://github.com/any-table/anytable); every build fetches it fresh from there and renders it to static HTML. There is no JavaScript, no analytics, and no third-party requests.

## How it builds

`build.sh` clones the newest release tag of `any-table/anytable` (`vMAJOR.MINOR.PATCH`; pre-release tags such as `v1.0.0-rc1` are ignored) into `content/`, then `build.mjs` renders its Markdown into `public/`. Merges to `main` in that repository are not published until they are tagged.

| Source | Page |
| --- | --- |
| `CARD.md` | `/` |
| `FOUNDATIONAL.md` | `/foundational/` |
| `READING.md` | `/reading/` |
| `CHANGELOG.md` | `/changelog/` |
| `CONTRIBUTING.md` | `/contributing/` |
| `GOVERNANCE.md` | `/governance/` |
| `NOTICE.md` + `LICENSE` | `/license/` |

A page whose file does not exist in the published tag is left out of the site and its navigation. The build also writes `404.html` and `sitemap.xml`.

The footer of every page names the text version and the exact tag and commit it was built from. The build fails, leaving the previous deployment live, if that version is inconsistent: the `FOUNDATIONAL.md` heading and its **Version.** line must agree, and when building from a `v*` tag they must match the tag. When cutting a release, update both lines and `CHANGELOG.md` before tagging.

Environment variables:

- `ANYTABLE_REF`: what to publish. Defaults to `latest-tag`. Any branch or tag name also works; set `main` on the Pages preview environment to preview unreleased text.
- `ANYTABLE_DIR`: build from a local checkout instead of cloning.

## Cloudflare Pages

Project settings (Workers & Pages → the Pages project → Settings → Builds):

- Production branch: `main`
- Framework preset: None
- Build command: `./build.sh`
- Build output directory: `public`
- Environment variable (optional): `ANYTABLE_REF`, e.g. `main` for preview deployments only

Pushes to this repository rebuild the site through the Git integration. New release tags in `any-table/anytable` rebuild it through a Pages deploy hook, called by a GitHub Actions workflow in that repository. The hook URL is a secret stored only as the `CLOUDFLARE_PAGES_DEPLOY_HOOK` Actions secret there.

## Local development

```sh
npm ci
./build.sh                          # or: ANYTABLE_DIR=../anytable ./build.sh
npx serve public
```

Node 20 or later is required (`.node-version` pins 22 for Cloudflare).

## Checks

Pull requests run `.github/workflows/check.yml`: `npm ci`, a build from the fixed release `v0.2.0`, and a check that the expected pages and files exist and the footer names that release.

## Social preview image

`static/og.png` (1200×630) is rendered from `src/og.html`. It is committed, not built, because the Cloudflare build has no browser. After editing `src/og.html`:

```sh
npm install --no-save playwright && npx playwright install chromium
node scripts/render-og.mjs
```

## Issues

This repository has its own issue forms, for website problems and suggestions. Problems with the text itself (wording, citations, quotations, translations) belong in [any-table/anytable](https://github.com/any-table/anytable/issues/new/choose), and the issue chooser here links there. Security problems are reported privately; see the organization's [security policy](https://github.com/any-table/site/security/policy).

## License

The code and design in this repository are dedicated to the public domain under [CC0 1.0 Universal](LICENSE). The text the site publishes lives in `any-table/anytable` and carries its own terms; see its `NOTICE.md`.
