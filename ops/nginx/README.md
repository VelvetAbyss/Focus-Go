# Public website and crawl files

`npm run build:web` now packages both sites into `apps/web/dist`:

- App: `dist/index.html`, `dist/robots.txt`, `dist/sitemap.xml`
- Marketing website: `dist/website/index.html`, assets and its own crawl files

The existing production workflow uploads that entire directory. The existing
release symlink can therefore switch both sites together without an additional
copy of the marketing HTML drifting behind.

## Hosting configuration required before release

The live Nginx configuration is managed outside this repository. Verify its
current roots and retain its TLS, proxy and other unrelated settings. In the
existing `nestflow.art` server block, use:

```nginx
root /var/www/focus-go/current/website;
```

Keep `app.nestflow.art` pointed at `/var/www/focus-go/current`. Install
`public-static-locations.conf` at a server-managed include path, and include it
inside both server blocks. For example:

```nginx
include /etc/nginx/snippets/focusgo-public-static-locations.conf;
```

Do not replace whole server blocks, change auth callbacks or redirect URIs, or
reload Nginx before the new release has a populated `website/` directory. Run
`nginx -t` before reloading. Preserve the previous configuration and release
symlink for rollback. If rolling back to an older release without `website/`,
restore the previous website Nginx root/configuration as well; switching only the
application symlink would otherwise take the website offline. Keep the old
`/var/www/nestflow` directory until the rollback window closes. Apply the matching staging root when checking staging.

## Verification

```sh
npm run build:web
npm run verify:public-site
# After an authorized release and any necessary CDN cache invalidation:
npm run verify:public-site -- --website-url https://nestflow.art/ --app-url https://app.nestflow.art/ --expected-release <deployed-commit-sha>
```

The HTTP check rejects homepage rewrites, wrong content types, stale pricing and
wrong-domain sitemap entries, stale assets and mismatched release identifiers. Also inspect English and Chinese pricing in a
browser, including mobile. The marketing sitemap lists two home languages, six English/Chinese guides and four static policy
routes; the app sitemap lists its public root only. Private workbench routes are
not submitted. See [P1 discovery operations](../seo/README.md) for the website-only
404 configuration, canonical-host redirects and remaining search measurements. This does not change the
application's indexing policy or crawler-training preferences.

GSC sitemap submission and processing status require a separate authenticated
check. Passing local verification is not proof that production has been changed.
