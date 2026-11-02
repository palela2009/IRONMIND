# Project instructions

- After making and verifying code updates, commit and push the task's changes to GitHub. The user authorized this as a standing preference on 2 November 2026; do not ask again for routine task-related pushes.
- This app repository uses the `master` branch. The backend is in the sibling `IRONMIND-backend` repository and uses `main`.
- Backend pushes trigger Render deployment. Check the live `/health` revision after a backend push before reporting that deployment is complete.
- A GitHub push does not update an installed Android app. Create release builds and submit or publish Play Store releases only when requested by the user.
- Preserve unrelated user changes and files. Do not commit secrets, generated build output, or personal screenshots.
- Do not add ordinary explanatory comments to source code. Keep necessary compiler directives and copyright or license notices.
- Preserve the existing visual style. Back up source changes outside the repositories so requested changes can be undone selectively.
- Read and write source as UTF-8. Avoid PowerShell `Get-Content` piped to `Set-Content` for edits because it can corrupt Unicode.
