# GitHub installation and WordPress-style updates

## First upload to GitHub

1. Use the `jrmediagroupvan/Project-Titan` repository.
2. Extract this ZIP on a computer.
3. Upload the extracted contents, not the ZIP itself.
4. Confirm `.env` is not present. Only `.env.example` should be committed.
5. Commit to the `main` branch.

For larger uploads, Git is recommended:

```bash
git init
git branch -M main
git remote add origin https://github.com/jrmediagroupvan/Project-Titan.git
git add .
git commit -m "Project TITAN v1.1.0"
git push -u origin main
```

## Install from GitHub

```bash
cd ~
git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan
cp .env.example .env
nano .env
chmod +x install.sh install/*.sh scripts/*.sh
sudo ./install.sh
```

## Update later

Owners can now open **Settings → TITAN Updates** and select **Update TITAN from GitHub**. The button is locked to the configured repository and `main` branch. The dedicated updater must be enabled as described in `README.md`.

Publish new code to `main`, then run on the TITAN server:

```bash
cd ~/Project-TITAN
sudo ./scripts/titan update
```

The updater:

1. Refuses to overwrite uncommitted server changes.
2. Creates a database/file backup.
3. Fetches and fast-forwards from GitHub.
4. Pulls service images and rebuilds TITAN.
5. Applies Prisma schema changes.
6. Recreates the containers.
7. Runs the health check.
8. Restores the previous app image and source revision if the health check fails.

Do not edit source files directly on the production server. Make changes in GitHub or a development clone, test them, then push a new version.
