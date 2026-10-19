# SRC Enterprises: srcenterprises.in

## Cloudflare Pages (static prototype)

The repository currently contains a browser-only prototype. **Do not treat the dashboard role selector as authentication** or enter actual personal/business data. No real payment or scheme enrollment is supported.

1. In Cloudflare, go to Workers & Pages → Create → Pages → Connect to Git.
2. Choose GitHub repository `bv-prasanna/SRC` and branch `main`.
3. Select a static HTML project (no framework). Build command: **leave blank**. Build output directory: **/** (repository root), if supported by the setup UI. For configurations requiring an output folder, set build command `mkdir -p dist && cp index.html dist/ && cp -r public/. dist/` and output directory `dist`.
4. Deploy and verify the assigned `.pages.dev` URL before attaching the domain.
5. Pages project → Custom domains → Add `srcenterprises.in` and optionally `www.srcenterprises.in`.
6. If DNS is hosted at Cloudflare, follow the verified DNS records the dashboard generates. Do not overwrite existing mail MX/TXT records. Enable HTTPS and redirect HTTP to HTTPS.
7. Add custom production analytics only after privacy/consent review.
8. Check mobile/desktop views, navigation, metadata and all CMS demo tabs.

## Pre-production blockers

- No backend, database, authentication or permission enforcement.
- All admin data persists **only in localStorage**, so cannot be shared across devices.
- No media upload, stock sync, invoicing or customer communications.
- No actual payment integrations and no online fireworks checkout.
- No completed integration, E2E or penetration testing.
- Confirm retail licensing and legal review before publishing factual commercial claims.

## Regulatory references

- Supreme Court order (23 Oct 2018): https://api.sci.gov.in/supremecourt/2015/32461/32461_2015_Judgement_23-Oct-2018.pdf
- PESO online sales circular (11 Apr 2023): https://peso.gov.in/sites/default/files/2023-04/ban%20on%20online%20sale%20of%20fw.pdf
