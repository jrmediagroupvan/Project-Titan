# Upload Project TITAN v3.1 to GitHub

Upload the **contents** of the extracted `Project-TITAN-v3.1-GitHub-Ready` folder to the root of your existing repository. Replace files with the same names; do not put them in an `update` subfolder.

Do not upload:

- `.env`
- `node_modules`
- `.next`
- `storage`
- `uploads`
- `backups`
- database exports
- Gmail tokens or provider credentials

## GitHub website

1. Extract the ZIP.
2. Open your repository.
3. Choose **Add file → Upload files**.
4. Drag all files and folders from inside the extracted folder into the upload area.
5. Commit with a message such as `Release Project TITAN v3.1`.

For reliable folder uploads and future updates, GitHub Desktop or Git is recommended.

## Git command line

```bash
git add .
git status
git commit -m "Release Project TITAN v3.1"
git push origin main
```

Review `git status` before committing and confirm that no `.env`, customer data, uploads or secrets appear.
