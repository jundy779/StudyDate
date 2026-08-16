# Search and AI Discovery Operations

Status: local readiness only. This document does not confirm indexing, ranking,
AI citation, or production activation.

## Canonical policy

- Canonical origin: `https://studydate.id`.
- Localhost, Vercel previews, and temporary aliases must never become canonical.
- HTTPS/apex redirects and DNS are Owner/platform operations outside this code
  change.
- Query parameters do not create distinct canonical pages.

## Indexability matrix

| Route | Public | Crawl | Index | Sitemap | Canonical | Structured data | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | yes | yes | yes | yes | `/` | Organization, WebSite | canonical product definition |
| `/insight` | yes | yes | yes | yes | self | BreadcrumbList | public knowledge index |
| `/insight/<published-slug>` | yes | yes | yes | yes | self | Article, BreadcrumbList | human-reviewed public knowledge |
| `/safety` | yes | yes | yes | yes | self | none | independent safety guidance |
| `/community-guidelines` | yes | yes | yes | yes | self | none | community rules |
| `/help` | yes | yes | yes | yes | self | none | product explanation |
| `/privacy`, `/terms` | yes | yes | yes | yes | self | none | public trust/legal pages |
| legacy Indonesian doc aliases | yes, redirect | yes | no separate index | no | destination | none | permanent canonical redirect |
| `/login`, `/staff/login`, `/onboarding` | entry/private | unnecessary | no | no | none | none | auth and onboarding state |
| `/app/**`, `/account/**` | private | no | no | no | none | none | student data and settings |
| `/owner/**`, `/admin/**`, `/staff/**` | private | no | no | no | none | none | staff operations |
| `/auth/**`, `/api/**` | operational | no | no | no | none | none | callbacks and server handlers |
| local audit routes | local only | no | no | no | none | none | test surfaces |
| unknown URLs | no | incidental | no | no | none | none | real 404 semantics |

Authorization remains the security boundary. Robots and `X-Robots-Tag` only
provide crawler/indexing instructions.

## Crawler policy

- Googlebot: public pages allowed; private/operational prefixes disallowed.
- Bingbot: same public-only policy.
- OAI-SearchBot: public pages allowed for ChatGPT Search eligibility; no private
  access is granted.
- PerplexityBot: public pages allowed; no private access is granted.
- GPTBot: no explicit policy change. Search discovery and model-training policy
  are separate Owner decisions.
- Google training-related crawlers: no policy change in this task.

`llms.txt` is intentionally absent. It is not required for Google Search,
Google AI features, ChatGPT Search, or Perplexity eligibility. Public HTML,
metadata, JSON-LD, sitemap, robots controls, and internal links are the
authoritative machine-readable surfaces.

## Structured data policy

- Homepage: deterministic `Organization` and `WebSite`.
- Public knowledge article: `Article` and `BreadcrumbList`.
- No `SearchAction` because there is no public website search.
- No ratings, reviews, people, partnerships, awards, or social `sameAs` without
  verified public evidence.
- Campus Events remain authenticated and are not promoted as public `Event`
  schema.

## Content and intent map

| Query family | Primary page | Intent |
| --- | --- | --- |
| aplikasi cari teman belajar mahasiswa | homepage, `/help` | product discovery |
| study date adalah | `/insight/apa-itu-study-date` | informational |
| cara aman bertemu teman online | `/safety`, study-date article | safety |
| networking mahasiswa | future reviewed insight | informational |
| cara mencari teman belajar | future reviewed insight | informational |
| privasi saat kenalan online | `/privacy`, future insight | trust/informational |

Do not create campus/name combinations or programmatic student-directory pages.

## Search Console Owner checklist

1. Add `studydate.id` as a Google Search Console Domain Property.
2. Complete DNS verification.
3. Submit `https://studydate.id/sitemap.xml`.
4. Inspect the homepage, `/insight`, the cornerstone article, `/safety`, and
   `/help`.
5. Monitor indexing and Search performance; do not infer indexing from a
   successful sitemap request.
6. Use generative-AI-specific reporting only if Google exposes it for the
   property.

## Bing Webmaster Tools Owner checklist

1. Add and verify `studydate.id`.
2. Submit the production sitemap.
3. Inspect key public URLs.
4. Approve an IndexNow key and operational design before enabling submissions.

IndexNow is disabled. A future implementation must be server-side, optional,
and limited to canonical published public URLs. Never submit app, auth, API,
staff, student, or query-result URLs.

## Measurement baseline

Vercel Web Analytics is limited to public pages. It may support aggregate
referral review for Google, Bing, ChatGPT, and Perplexity without student PII.
Do not track NIM, profile identifiers, conversation content, contact data, or
verification state.

Record values only after production activation:

```text
indexed_public_pages:
google_impressions:
google_clicks:
branded_queries:
non_branded_queries:
ai_search_visibility:
chatgpt_referrals:
perplexity_referrals:
bing_impressions:
organic_signup_conversion:
```

## Publishing and rollback

- Publish only human-reviewed, public-value content.
- Add a sitemap entry only for an actually published article.
- Missing slugs must return 404.
- Rollback: remove affected public links/sitemap entries and set page metadata
  to `noindex`; do not expose or weaken private authorization.
- If a private URL appears in an index, verify auth first, retain `noindex`,
  remove public links/sitemap references, and request removal through the
  relevant webmaster tool.

## Production activation after Owner approval

1. Deploy the committed Search/AI code.
2. Verify valid HTTPS and the intentional apex/`www` redirect policy.
3. Verify the homepage canonical remains `https://studydate.id`.
4. Verify `/robots.txt`.
5. Verify `/sitemap.xml`.
6. Verify `/insight` and the cornerstone article.
7. Verify representative private routes remain authenticated and `noindex`.
8. Add the Google Search Console Domain Property.
9. Complete Search Console DNS verification.
10. Submit the sitemap in Search Console.
11. Inspect the homepage URL.
12. Inspect the cornerstone article URL.
13. Add the Bing Webmaster Tools property.
14. Complete Bing verification.
15. Submit the sitemap in Bing.
16. Decide IndexNow separately.
17. Monitor crawl and index status.
18. Monitor aggregate organic and AI referrals without student PII.
