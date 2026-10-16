import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/proposal/"] },
    ],
    sitemap: "https://amorimuori.com/sitemap.xml",
  };
}
