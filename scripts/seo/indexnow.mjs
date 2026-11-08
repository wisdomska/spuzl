#!/usr/bin/env node
// Tells IndexNow (Bing, Yandex, Seznam, Naver...) about every page in the live sitemap, in one POST.
// Usage: INDEXNOW_KEY=<key> node scripts/seo/indexnow.mjs [--site https://spuzl.vercel.app] [--dry-run]
//
// The same INDEXNOW_KEY must be set on the deployment first, so https://<site>/<key>.txt answers with the key
// (proxy.ts, lib/seo/indexnow.ts). Run it after a deploy that adds or changes public pages. docs/OPERATIONS.md.
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const site = (flag("--site") || process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app").replace(/\/+$/, "");
const dryRun = args.includes("--dry-run");
const key = process.env.INDEXNOW_KEY;

if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
  console.error("Set INDEXNOW_KEY (8 to 128 characters: letters, digits and dashes), the same value the site serves.");
  process.exit(1);
}

const host = new URL(site).host;
const keyLocation = `${site}/${key}.txt`;

// The key file must be live, or IndexNow rejects the batch (403).
const keyRes = await fetch(keyLocation);
const keyBody = keyRes.ok ? (await keyRes.text()).trim() : "";
if (keyBody !== key) {
  console.error(
    `${keyLocation} answered ${keyRes.status}${keyRes.ok ? " with a different key" : ""}. Set INDEXNOW_KEY on the deployment first.`,
  );
  process.exit(1);
}

const xml = await (await fetch(`${site}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => new URL(u).host === host);
if (urls.length === 0) {
  console.error(`No URLs for ${host} in ${site}/sitemap.xml.`);
  process.exit(1);
}

const body = { host, key, keyLocation, urlList: urls };
console.log(`${urls.length} URLs from ${site}/sitemap.xml`);
if (dryRun) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
// 200 OK and 202 Accepted both mean the batch was received.
console.log(`IndexNow answered ${res.status} ${res.statusText}`);
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
