# FitnessPilot version checkpoints (Git tags)

FitnessPilot keeps **one** active preview source tree in `preview-v101/`. That folder name is historical, not a release number. The production app is separate at the repository root. Do **not** duplicate the preview folder for every version or change the app's browser storage keys.

A Git tag fixes a **source commit**, not a copy of the user's locally stored workouts or Food Diary. GitHub Pages still serves its configured source; creating a tag does not promote preview to production.

## Tag names and evidence

| Tag | Meaning | Required before tagging |
| --- | --- | --- |
| `preview-ci-vX.Y.Z` | Source checkpoint, **not** device-approved | The exact commit is on `main`, the preview banner says `VX.Y.Z`, and required GitHub CI jobs on that commit passed |
| `vX.Y.Z` | Owner-approved release | All applicable gates in `docs/decisions/2026-11-05-roadmap-owner-decisions.md` (including real-device and recovery checks) are recorded as passed or not applicable, plus explicit owner release approval |

The version comes from the `FITNESSPILOT Vx.y.z PREVIEW` banner in `preview-v101/index.html`. The manifest and service-worker cache must agree as required by `AGENTS.md` §4. Do not infer a version from the directory name.

- Use **annotated** tags that point to the exact tested commit SHA, never to a moving branch name.
- Never reuse, force-update, or delete an existing published version tag as part of a normal release. A fix gets a new version and new tag.
- One tag may identify a historical source checkpoint; neither a tag nor a successful CI job proves what a real iPhone displayed.
- Keep release notes in the changelog once the documentation PR is merged; record evidence and outstanding device checks separately. No personal data, backups, or device logs in public Git history.

## Manual tag procedure (PowerShell or Git Bash)

**Read-only inspection:** use a local checkout with Git remote `origin` pointing at `ToggleHardestMode/Fitness`. Replace `X.Y.Z` and `COMMIT_SHA` with the exact values verified from the banner and CI. Do not run against an arbitrary branch or commit.

```sh
git fetch origin main --tags
git status --porcelain
git rev-parse origin/main
git show --no-patch --format=fuller COMMIT_SHA
git tag --list "preview-ci-vX.Y.Z"
git ls-remote --tags origin "refs/tags/preview-ci-vX.Y.Z"
```

Stop if the worktree is dirty, the chosen commit is not the intended `origin/main`, either tag already exists, the preview version differs, or exact-commit CI evidence is missing. For `vX.Y.Z`, independently verify the recorded owner release and device gates first.

**Manual application only, after these checks:** create and push one explicit annotated tag (no wildcard, no `--force`).

```sh
git tag -a preview-ci-vX.Y.Z COMMIT_SHA -m "FitnessPilot preview X.Y.Z; exact-commit CI verified; device acceptance not claimed"
git push origin refs/tags/preview-ci-vX.Y.Z
```

Verify the remote ref independently with `git ls-remote --tags origin "refs/tags/preview-ci-vX.Y.Z"`. Because annotated tags are objects, compare the **peeled commit** with the intended SHA using `git rev-parse "refs/tags/preview-ci-vX.Y.Z^{commit}"` (or inspect the remote tag after fetching). If a push response is uncertain, check the remote ref before doing anything else; do not blindly retry. The local tag can be removed if never pushed, but published tags should be treated as immutable.

For a genuinely owner-approved release, substitute `vX.Y.Z` in the final two commands and use a release message that records the exact approval/evidence. **No tag is created merely by adopting this policy.**

## Baseline at adoption

On 2026-11-12, `main` pointed to `1e4b076e3510644ec61a9b7d5b7beac1f48ef332` with preview banner `V15.26.14`. GitHub Actions push run `43019579624` reported success. Real iPhone acceptance and the release gates were **not** established here. Accordingly, `v15.26.14` must **not** be called a device-approved release without additional evidence. This documentation change does not itself create a tag; any source checkpoint requires a separate, explicit tag operation and verification.
