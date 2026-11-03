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

## Deployment

The app is deployed on [Render](https://render.com) as a Docker web service, defined in the repository's root `render.yaml` and built from this folder's `Dockerfile`.

Widget data is cached and refreshes on its own every 24 hours. To force an immediate refresh, set a `CRON_SECRET` environment variable on the service and call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-service>.onrender.com/api/cron
```
