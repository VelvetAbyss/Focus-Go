# P1 discovery implementation and remaining production gates

Prepared after the P0 release commit, on a separate branch. No P1 production
configuration change or deployment is implied by a successful local build.

## Prepared

- Focus&go is the product name; Nestflow remains the domain/upper-level name,
  as confirmed by the owner on 2026-10-22.
- Product title, H1, first paragraph, Open Graph metadata and canonical homepage.
- Final research figures in the initial HTML, without zero-valued counters.
- Three substantive guides, with separate English and Chinese URLs, self
  canonicals, reciprocal hreflang and static answer text.
- Seven public sitemap entries and crawlable links from the homepage and guides.
- A useful noindex 404 document and a canonical-website-only Nginx route snippet.
- README entry points to app.nestflow.art, rather than the legacy Vercel domain.

The public web source currently gates protected interactions behind sign-in.
Product copy distinguishes that account rule from free features and local-first
saving. New-device cloud sync defaults to enabled and runs after sign-in unless
disabled; the copy makes that default explicit. No auth configuration, callback chain or product behavior is changed.

## Deployment configuration to review before P1 release

1. Replace only the canonical marketing site's `location /` with
   `ops/nginx/p1-website-routes.conf`; this snippet owns that location and the 404
   document. Do not apply it to the SPA application server.
2. Replace the website HTTP server with a permanent redirect to
   `https://nestflow.art$request_uri` and split `www.nestflow.art` into its own
   TLS server that redirects to the same canonical host. Retain existing TLS
   paths; back up the current configuration and run `nginx -t` before reload.
3. A historical `.bak` file in sites-enabled is also loaded by Nginx and causes
   duplicate-server warnings. Move that backup to the release backup directory,
   rather than deleting it, before final alias validation.
4. Retire the legacy Vercel host separately. Review the current Vercel project
   domains and callback/deep-link behavior before adding redirects; do not
   silently alter the protected auth callback chain. The README fix alone does
   not retire the host or prove that indexed legacy URLs have migrated.

## Validation

`npm run verify` includes `verify:public-site` and `verify:discovery`. For a
website served at the root of a local preview, run:

```sh
npm run verify:discovery -- --base-url http://127.0.0.1:4598/
```

Check all seven routes without JavaScript, reciprocal language navigation,
mobile overflow, dark mode, canonical/metadata and status codes. Raw HTML and
HTTP checks do not establish Google indexing, ranking or AI citation.

## Measurement baseline and external access still required

No search volume, ranking, conversion count or AI citation rate is invented.
The following remain `unverified` until authenticated evidence is available:

| Evidence | Required next check |
|---|---|
| GSC ownership and submitted sitemap | Domain property and sitemap processing result |
| Indexing | URL Inspection on homepage and each new content route |
| Search performance | Export 28/90-day query and landing-page data with country/device |
| Real crawler access | Verify Googlebot/OAI-SearchBot IPs and CDN/WAF responses |
| Conversion | Existing analytics attribution from site visit to meaningful app use |
| AI citations | Repeated independent queries per platform with answer and source URLs |

Public HTML contains a Cloudflare Insights beacon; this does not establish
access to its dashboard or a conversion funnel. Optional analytics must follow
the product privacy choices; this change does not add a tracker.

Candidate repeatable questions: what is Focus&go; is it free; how it relates to
Nestflow; when sign-in is required; what local-first means; cloud allowance;
free task-linked Pomodoro tools; and how Focus&go compares with Super
Productivity. Keep language/region/device/platform and the repeat denominator.
Record mentions, actual official-site citations and unprompted recommendations
separately. Check early technical signals after seven days, with longer
observation for search and product-use outcomes.

Before choosing the content architecture, public GitHub options Astro
(withastro/astro) and vite-ssg (antfu-collective/vite-ssg) were checked. This
small content addition keeps the existing static HTML pipeline and adds no
runtime dependency or framework migration.

## P2 continuation

See [P2 implementation](P2.md) for the twelve-route build, static policy source,
URL-based language selection and structured-data verification. Prepared source
is not proof of a production release.
