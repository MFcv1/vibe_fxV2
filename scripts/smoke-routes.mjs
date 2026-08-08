import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const publicRoutes = [
  "/",
  "/outil-publication-reseaux-sociaux",
  "/editeur-image-instagram",
  "/publier-instagram-facebook",
  "/templates",
  "/ressources/meta-oauth-publication-instagram-facebook",
  "/ressources/formats-instagram",
];

const utilityRoutes = ["/robots.txt", "/sitemap.xml"];
/* Surfaces app privees: /creer (VibeOS) et /publier ont remplace /studio. */
const privateRoutes = ["/creer", "/publier", "/account", "/account/billing", "/account/usage"];

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response.text();
}

function staticChunkUrls(html) {
  return [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/chunks\/[^"]+)"/g)]
    .map((match) => match[1]);
}

for (const route of [...publicRoutes, ...utilityRoutes, ...privateRoutes]) {
  await fetchText(route);
}

for (const route of publicRoutes) {
  const html = await fetchText(route);
  assert.match(html, /application\/ld\+json/, `${route} should include JSON-LD`);
  assert.match(html, /rel="canonical"/, `${route} should include a canonical link`);
  assert.match(html, /<meta name="robots" content="index, follow"/, `${route} should declare index, follow`);
  assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/i, `${route} should not declare noindex`);

  const chunks = staticChunkUrls(html).join("\n");
  assert.doesNotMatch(chunks, /src_app_studio|src_features_publications|src_features_vibefx/i, `${route} should not load studio chunks`);
}

/* Phase F: /studio ne rend plus rien, il redirige vers la surface VibeOS. */
const studioRedirect = await fetch(`${baseUrl}/studio`, { redirect: "manual" });
assert.ok(
  [301, 302, 307, 308].includes(studioRedirect.status),
  `/studio should redirect, got ${studioRedirect.status}`,
);
assert.match(
  studioRedirect.headers.get("location") || "",
  /\/creer$/,
  "/studio should redirect to /creer",
);
const studioWorkspace = await fetch(`${baseUrl}/studio?workspace=vision-pro`, { redirect: "manual" });
assert.match(
  studioWorkspace.headers.get("location") || "",
  /\/creer\/vision$/,
  "/studio?workspace=vision-pro should redirect to /creer/vision",
);

for (const route of privateRoutes) {
  const html = await fetchText(route);
  assert.match(html, /noindex/, `${route} should be noindex`);
}

const robots = await fetchText("/robots.txt");
assert.match(robots, /Disallow: \/creer/, "robots.txt should disallow /creer");
assert.match(robots, /Disallow: \/publier/, "robots.txt should disallow /publier");
assert.match(robots, /Sitemap:/, "robots.txt should expose sitemap");

const sitemap = await fetchText("/sitemap.xml");
assert.match(sitemap, /<loc>https?:\/\/[^<]+<\/loc>/, "sitemap should include the home URL");
for (const route of publicRoutes.slice(1)) {
  assert.match(sitemap, new RegExp(route), `sitemap should include ${route}`);
}

console.log(`route smoke test OK (${baseUrl})`);
