/**
 * IndexNow (Bing, Yandex and others): the site proves it owns its key by serving a text file named after the key,
 * /<key>.txt, whose body is the key. The key comes from the INDEXNOW_KEY environment variable; with none set,
 * nothing is served (the path is a plain 404). scripts/seo/indexnow.mjs submits the sitemap's URLs with the key.
 */

/** IndexNow keys: 8 to 128 characters of a-z, A-Z, 0-9 and dashes. */
export const isIndexNowKey = (key: string | undefined | null): key is string => !!key && /^[a-zA-Z0-9-]{8,128}$/.test(key);

/** The key file's response for `/<key>.txt`, or null for every other path (and when no valid key is set). */
export function indexNowKeyResponse(pathname: string, key: string | undefined): Response | null {
  if (!isIndexNowKey(key) || pathname !== `/${key}.txt`) return null;
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
