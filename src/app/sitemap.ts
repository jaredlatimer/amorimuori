import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://amorimuori.com", lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: "https://amorimuori.com/order", lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: "https://amorimuori.com/catering", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://amorimuori.com/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://amorimuori.com/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
