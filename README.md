# site

The website for the any table belief system, published at [anytable.org](https://anytable.org).

This repository holds only the presentation. The text itself lives in [any-table/anytable](https://github.com/any-table/anytable); every build fetches it fresh from there and renders it to static HTML. There is no JavaScript, no analytics, and no third-party requests.

## How it builds

`build.sh` clones `any-table/anytable` into `content/`, then `build.mjs` renders its Markdown into `public/`:

| Source | Page |
| --- | --- |
| `CARD.md` | `/` |
| `FOUNDATIONAL.md` | `/foundational/` |
| `READING.md` | `/reading/` |
| `CHANGELOG.md` | `/changelog/` |
| `CONTRIBUTING.md` | `/contributing/` |
| `NOTICE.md` + `LICENSE` | `/license/` |

The footer of every page names the text version and the exact commit it was built from.

Environment variables:

- `ANYTABLE_REF`: branch or tag to publish. Defaults to `main`. Set it to `latest-tag` to publish the newest `v*` tag instead.
- `ANYTABLE_DIR`: build from a local checkout instead of cloning.

## Cloudflare Pages

Project settings (Workers & Pages → the Pages project → Settings → Builds):

- Production branch: `main`
- Framework preset: None
- Build command: `./build.sh`
- Build output directory: `public`
- Environment variable (optional): `ANYTABLE_REF`

Pushes to this repository rebuild the site through the Git integration. Pushes to `any-table/anytable` rebuild it through a Pages deploy hook, called by a GitHub Actions workflow in that repository. The hook URL is a secret stored only as the `CLOUDFLARE_PAGES_DEPLOY_HOOK` Actions secret there.

## Local development

```sh
npm ci
./build.sh                          # or: ANYTABLE_DIR=../anytable ./build.sh
npx serve public
```

Node 20 or later is required (`.node-version` pins 22 for Cloudflare).
