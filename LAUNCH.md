# Launch checklist

Everything below can be done in the browser. You do not need Node, git or a terminal.

## Already done

- **Launch date:** puzzle #1 is **Friday 16 October 2026** (UTC). It is set in `RULES.launchDate` in `src/engine.js`. Never change it after launch: puzzle numbers, the frozen puzzle files and every player's saved progress depend on it.
- **First puzzles frozen:** `puzzles/1.json` to `puzzles/21.json` are in the repo, so the first three weeks are fixed.
- **Tests and data checks** pass, and they run again on every upload.

## 1. Create the repository

1. Sign in at github.com (or sign up).
2. Click **+** at the top right, then **New repository**.
3. Name it `cleansweep`.
4. Choose **Public**. Free GitHub Pages needs a public repository.
5. Leave README, .gitignore and licence **unticked**. They are already in the files.
6. Click **Create repository**.

## 2. Upload the files

1. Unzip `cleansweep-repo.zip`. You get a folder called `cleansweep`.
2. On the empty repository page, click **uploading an existing file**.
3. Open the unzipped folder, select everything inside it, and drag it into the browser window.
   - On a Mac, press **Cmd + Shift + .** in Finder first, so the hidden `.github` folder shows. It must be uploaded.
4. Wait for the uploads to finish. You should see `.github`, `data`, `docs`, `puzzles`, `scripts`, `src`, `tests`, `index.html` and the other files.
5. Leave **Commit directly to the main branch** selected and click **Commit changes**.

## 3. Turn on the website

1. Go to **Settings**, then **Pages**, then set **Source** to **GitHub Actions**.
2. Open the **Actions** tab. If asked, enable workflows.
3. Wait for **Deploy to GitHub Pages** to turn green (a minute or two). If it is red, open it and read the first error.
4. Settings, Pages now shows your link: `https://YOUR-USERNAME.github.io/cleansweep/`.
5. Open the link on your phone and play. Puzzle #1 should say Clean Sweep and show today's puzzle.

## 4. Let the weekly job open pull requests

1. Go to **Settings**, then **Actions**, then **General**.
2. Under **Workflow permissions**, tick **Allow GitHub Actions to create and approve pull requests**, then **Save**.
3. Open the **Actions** tab, choose **Generate upcoming puzzles**, click **Run workflow**, and check a pull request appears under **Pull requests**. Merge it: it adds puzzle files for the next three weeks.

## 5. Each week

Every Monday a pull request appears with new puzzle files. Skim a couple, then merge it. The aim is to always have at least two weeks frozen ahead. If you miss a week the game still works: it falls back to generating the day's puzzle on the spot.

Frozen puzzles never change when you edit facts later. Only unfrozen days pick up the new facts.

## 6. Small things to settle

- **Licence.** Choose one (MIT is common for code) and decide how others may reuse `data/facts.json`. Until you do, the default is "all rights reserved".
- **Name.** Check "Clean Sweep" for clashes: domain, GitHub name, app stores, existing games.
- **Web address on the share card.** Once friends have tried it, set `RULES.shareUrl` in `src/engine.js`. It is then added as the last line of every share card.
- **Google Fonts.** The page loads two fonts from Google. For UK and EU visitors, consider hosting them yourself so visitors' addresses are not sent to Google.
- **Wikidata harvest** (optional, needs Node): run it with `HARVEST_CONTACT="you@example.com" npm run harvest`.

## If you prefer the command line

```
git init
git add .
git commit -m "Clean Sweep"
git branch -M main
git remote add origin git@github.com:YOUR-NAME/cleansweep.git
git push -u origin main
```
