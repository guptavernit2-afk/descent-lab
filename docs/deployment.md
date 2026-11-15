# Deployment

The current laboratory builds to a static `dist/` directory. It requires no server runtime, database, secrets, or API keys.

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
