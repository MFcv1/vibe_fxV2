export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibefx.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /* Surfaces app privees: /creer (VibeOS) et /publier ont remplace /studio,
           qui reste liste tant que des liens externes y mènent. */
        disallow: ["/creer", "/publier", "/studio", "/account", "/api", "/admin", "/backoffice"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
