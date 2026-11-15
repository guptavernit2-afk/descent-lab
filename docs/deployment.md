# Deployment

The current laboratory builds to a static `dist/` directory. It requires no server runtime, database, secrets, or API keys.

## Recommended: Vercel

Vercel and Render both support static frontends. Vercel is a direct fit for this Vite project, with framework detection and Git-linked previews. The application does not need a continuously running Render web service; if deploying there, use a Static Site. See [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite) and [Render's static-site documentation](https://render.com/docs/static-sites).

For a permanent deployment, connect the GitHub repository to your Vercel account and import it with the Vite framework preset. Use `npm ci`, `npm run build`, and output directory `dist`. The committed `vercel.json` specifies these settings, security response headers, and immutable caching for hashed assets. Browser workspaces use the `page` query parameter, so no catch-all rewrite is required; the original `legacy/` directory remains a real static route.

An authenticated CLI can also deploy the project:

```bash
npx vercel login
npx vercel deploy --prod
```

Vercel also supports `npx vercel deploy --temporary` without an account. That command builds locally and returns a production URL, a private claim link, and a server-set expiry. **The deployment must be claimed before that expiry to remain available.** A temporary deployment is not a substitute for account ownership or ongoing Git integration. Claim links control the project and must never be put in Git, a README, or a public issue. After claiming, connect the repository for future deployments. [Official temporary-deployment documentation](https://vercel.com/docs/deployments/deploy-without-logging-in).

The `.vercelignore` file excludes local caches, credentials, dependency folders, and test artifacts. `.vercel/` is also Git-ignored. The GitHub Pages URL remains an independently deployed, durable fallback.

## GitHub Pages

The repository includes two workflows:

- **CI** installs the lockfile, checks TypeScript, runs unit tests, builds the application, and runs Playwright against Chromium on pushes and pull requests.
- **Deploy to GitHub Pages** runs after a successful CI workflow on `main`, or from a manual dispatch. It checks out the validated commit, builds the static artifact, and deploys it through the `github-pages` environment.

In repository **Settings → Pages**, select **GitHub Actions** as the build source. The repository must permit Actions and Pages deployments, and the `github-pages` environment must allow the selected branch. If an environment has required reviewers, GitHub will wait for that review; committing a workflow does not override repository protection.

The deployment workflow sets `VITE_BASE_PATH` to the repository path returned by the Pages configuration action. This supports repository Pages URLs and custom domains without hard-coding the owner or repository name into application assets. The published URL appears in the workflow's deployment environment after a successful deployment.

## Other static hosts

```bash
npm ci
npm run build
npm run preview
```

Publish the contents of `dist/`, preserving its assets and legacy subdirectory. The default relative base (`./`) supports hosting below a subdirectory. Set `VITE_BASE_PATH` at build time if a host requires an explicit asset prefix. There are no server-side routes to configure.

## Troubleshooting

| Symptom                          | Check                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Blank page or missing assets     | Ensure the whole `dist/` directory was uploaded and the build base matches the serving path. |
| Pages configuration fails        | Enable Pages with the GitHub Actions source and confirm repository permissions.              |
| Deployment is waiting            | Inspect the `github-pages` environment's protection rules.                                   |
| Browser tests cannot launch      | Run `npx playwright install chromium`; on Linux, add `--with-deps` for system dependencies.  |
| Saved experiments appear missing | Storage is per browser and origin. A local preview and a hosted URL have separate storage.   |
| Legacy page is missing           | Run a fresh build so the original 1D HTML is copied into the output.                         |

Never commit a personal access token or a local environment file to resolve a deployment problem. The supplied workflow uses GitHub's scoped workflow token and an OIDC identity for Pages.
