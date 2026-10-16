import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The old catering form became the Events page; /api/catering-inquiry is unchanged
  async redirects() {
    return [{ source: "/catering", destination: "/events", permanent: true }];
  },
};

export default nextConfig;
