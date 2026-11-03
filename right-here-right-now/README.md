This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This project uses [pnpm](https://pnpm.io); `pnpm-lock.yaml` is the only lockfile (the Dockerfile installs with pnpm too).

Install dependencies:

```bash
pnpm install
```

Then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Elections (News page)

The News page shows each listed country's head of government and ten highest-ranking posts, read from official government websites. When a country holds a general or snap election, blur its card: it shows your written reason on top until the new government is published.

A blurred card unblurs by itself once polling day has arrived **and** the official website lists a different government from the one recorded when it was blurred. If a leader is re-elected and keeps exactly the same cabinet, unblur it by hand.

Closures are stored in `src/data/elections.json` and go live when Render deploys that file.

### From the admin page

Go to `/admin/elections` on the live site and sign in. Each country has a switch:

- **Switch on** to blur it: enter the reason shown on the card, the polling day and (optionally) a later date to blur from.
- **Switch off** to unblur it straight away.

Each change is committed to `src/data/elections.json` on GitHub, and Render's auto-deploy publishes it (usually within a few minutes; the admin page says when a change is still waiting to go live).

One-off setup on the Render service (**Environment** tab):

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | The password for the admin page. Without it the page is switched off. Changing it signs everyone out. |
| `GITHUB_TOKEN` | A [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with access to only this repository and the **Contents: Read and write** permission. |
| `GITHUB_BRANCH` | Optional; the branch Render deploys from (default `main`). |
| `GITHUB_REPO` | Optional; default `AllSeeingOwl/Trivial-Things`. |

Render's **Auto-Deploy** must be on for that branch (Settings → Build & Deploy), otherwise changes are saved but don't go live until the next manual deploy.

### From the command line

```bash
pnpm election close uk-government --date 2027-05-06 --reason "Parliament has been dissolved and a general election called for 6 May 2027."
pnpm election reopen uk-government
pnpm election list
```

Add `--from YYYY-MM-DD` to `close` to blur from a later date. Commit and push `src/data/elections.json` afterwards. Country keys: `uk-government`, `us-government`, `canada-government`, `germany-government`, `japan-government`, `italy-government`, `spain-government`.

## Deployment

The app is deployed on [Render](https://render.com) as a Docker web service, defined in the repository's root `render.yaml` and built from this folder's `Dockerfile`.

Widget data is cached and refreshes on its own every 24 hours. To force an immediate refresh, set a `CRON_SECRET` environment variable on the service and call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-service>.onrender.com/api/cron
```
