# Get SPUZL indexed and listed

You're helping me, Senya, launch my web app SPUZL: https://spuzl.vercel.app. It's 41 free puzzle games in
four worlds (Puzzles, Words & Quiz, Arcade, Board Games) that run in the browser.

The site's SEO is already done and live:

- `robots.txt` and the sitemap at https://spuzl.vercel.app/sitemap.xml;
- structured data on every public page;
- a page for every game at `/games/<game>`, and a catalogue at `/games`;
- an FAQ on the landing page and on `/how-to-play`;
- `/llms.txt` and `/llms-full.txt`.

Bing and the other IndexNow search engines were sent every page on 9 November 2026.

**Already done in Google Search Console:** the `https://spuzl.vercel.app/` property is verified (the
`google-site-verification` tag is live in the page source) and `sitemap.xml` was submitted. Don't add or verify
the property again.

What's left needs my logged-in browser. Work through the tasks below in Chrome. Copy for the listings is in
**LAUNCH_COPY.md**, which I'll attach or paste. Use it word for word unless a form's length limit forces a cut.
Don't invent features, numbers or reviews.

## Ground rules

- **Stop and ask me before** you create an account, accept terms, publish or submit anything public, or spend
  money.
- I sign in myself. Never type a password. If a login, CAPTCHA or 2FA prompt appears, pause and tell me.
- Use my own accounts: my Google account for Search Console, and my Vercel account for the `spuzl` project.
- Don't post on Reddit or social media. Leave those drafts for me.
- When you finish, give me a checklist of what's done, what's waiting on me, and any links.

## 1. Google Search Console (checks only)

1. Go to https://search.google.com/search-console and open the `https://spuzl.vercel.app/` property.
2. Open **Sitemaps** and check that `sitemap.xml` reads **Success** with about 53 discovered pages. If it says
   "Couldn't fetch", note the exact message and tell me. Don't resubmit more than once.
3. Open **URL Inspection** and click **Request indexing** for each of these:
   - `https://spuzl.vercel.app/`
   - `https://spuzl.vercel.app/games`
   - `https://spuzl.vercel.app/how-to-play`
   - `https://spuzl.vercel.app/games/crownfall`
   - `https://spuzl.vercel.app/games/oware`
   - `https://spuzl.vercel.app/games/ludo`
4. Open **Pages** and note how many pages are indexed and the top "Why pages aren't indexed" reasons, word for
   word. It's normal for this to be low in the first days.

## 2. Bing Webmaster Tools

1. Go to https://www.bing.com/webmasters and sign in with the same Google account.
2. If spuzl.vercel.app is already there, skip to step 4.
3. Choose **Import from Google Search Console**, pick spuzl.vercel.app, and import it. This verifies the site and
   brings the sitemap across.
4. If the import isn't offered, add the site by hand and choose the **HTML Meta Tag** method:
   1. Copy only the `content` value of the `msvalidate.01` tag.
   2. In Vercel, open the `spuzl` project, then Settings, then Environment Variables. Add
      `NEXT_PUBLIC_BING_SITE_VERIFICATION` with that value, for **Production**. Save it.
   3. Open Deployments, find the latest Production deployment and **Redeploy** it. Wait until it says Ready.
      The variable is read at build time, so a redeploy is needed.
   4. View the source of https://spuzl.vercel.app and search for `msvalidate.01`.
   5. Click Verify in Bing, then submit `https://spuzl.vercel.app/sitemap.xml`.
5. Under **IndexNow**, check that URL submissions from spuzl.vercel.app appear.

## 3. Vercel project avatar

1. In Vercel, look at the `spuzl` project tile. If it still shows the black "N" instead of the green Spuz face,
   open the project, then Settings, then General, then **Project Avatar**.
2. Upload the icon from https://spuzl.vercel.app/icon.png. Save it to the computer first, then upload.

## 4. Listings (draft and fill, then ask me before submitting)

- **AlternativeTo** (https://alternativeto.net): suggest a new app using the AlternativeTo section of
  LAUNCH_COPY.md. List it as an alternative to NYT Games, Puzzmo, LinkedIn Games and Simon Tatham's Portable
  Puzzle Collection.
- **Product Hunt** (https://www.producthunt.com): start a new launch as a draft, with the Product Hunt section of
  LAUNCH_COPY.md. Use https://spuzl.vercel.app/opengraph-image as the thumbnail. Don't schedule or launch it. I'll
  pick the day.
- **itch.io** (https://itch.io): create a new project with the kind set to HTML or external link, pointing to
  https://spuzl.vercel.app. Use the AlternativeTo long description. Classification: Games, genre Puzzle. Leave it
  as a draft.

## 5. Checks at the end

- Run Google's Rich Results Test (https://search.google.com/test/rich-results) on these three pages:
  - `https://spuzl.vercel.app/`
  - `https://spuzl.vercel.app/games/crownfall`
  - `https://spuzl.vercel.app/how-to-play`

  Note which rich result types it finds (expect FAQ, Breadcrumbs and, on the game page, Software App or Video
  Game) and any errors or warnings.

- Open https://spuzl.vercel.app/opengraph-image and https://spuzl.vercel.app/games/crownfall/opengraph-image. Tell
  me if the share cards look right.
- Paste https://spuzl.vercel.app into the WhatsApp chat with yourself, without sending it to anyone else. Tell me
  if the preview shows the card, the title and the description.
- Report back with the checklist. Include anything that failed, word for word.
