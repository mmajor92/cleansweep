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

## 5. The two practice puzzles

`puzzles/practice-1.json` and `puzzles/practice-2.json` are the fixed practice puzzles. They are uploaded with everything else and never change. The weekly puzzle job ignores them.

## 6. Each week

Every Monday a pull request appears with new puzzle files. Skim a couple, then merge it. The aim is to always have at least two weeks frozen ahead. If you miss a week the game still works: it falls back to generating the day's puzzle on the spot.

When you publish any change, bump the version in `src/version.js` and add a line to `CHANGELOG.md`, so you can see on the live page that the new files have arrived.

Frozen puzzles never change when you edit facts later. Only unfrozen days pick up the new facts.

## 7. Settled, and still to settle

Settled:
- **Licence:** all rights reserved, in the name of Michael Major (the `LICENSE` file).
- **Fonts:** hosted on this site in `src/fonts`, so visitors' addresses are not sent to Google.
- **Address:** the game stays at the GitHub address. The share card ends with `tinyurl.com/cleansweepdaily`, which redirects there. It is set by `RULES.shareUrl` in `src/engine.js` (set it to an empty pair of quotes to leave it off).

Still to settle:
- **Name.** "Clean Sweep" is a common phrase and used by other apps. If the game grows, check the UK Intellectual Property Office's trade mark search before spending money on a domain or ads.
- **A real domain, one day.** Saved streaks belong to the address, so changing it resets everyone once. Buying a domain (about £7 to £15 a year) and making it the permanent address lets you change hosting later without that. If you move the site, update the TinyURL, or set `RULES.shareUrl` to the new address.
- **Wikidata harvest** (optional): the easiest way is on GitHub. Open **Actions**, pick **Harvest candidate facts**, press **Run workflow**, then download `harvest-candidates` from the bottom of the run page. It only finds candidates; each one still needs a source and a second check. With Node you can also run `HARVEST_CONTACT="you@example.com" npm run harvest`.

## 8. Optional: count your players

Counting is off until you give it a code. It is free for non-commercial sites, uses no cookies and keeps no personal data.

1. Go to goatcounter.com and sign up.
2. Choose a **site code** (for example `cleansweep`). Your dashboard will be at `https://cleansweep.goatcounter.com`.
3. On GitHub, open `src/site.js`, click the pencil, put the code between the quotes (`GOATCOUNTER_CODE = "cleansweep"`), and click **Commit changes**. Bump the version in `src/version.js` too.
4. After the site redeploys, open the game once, then check the dashboard. You should see a visit.
5. The dashboard shows visits and the two events: `finished` (a daily puzzle completed) and `clean-sweep` (7 out of 7). Keep the dashboard private, which is the default.

## If you prefer the command line

```
git init
git add .
git commit -m "Clean Sweep"
git branch -M main
git remote add origin git@github.com:YOUR-NAME/cleansweep.git
git push -u origin main
```
