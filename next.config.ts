import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      // The Calendar replaced the Dashboard as the home page; keep old links and bookmarks working.
      { source: "/dashboard", destination: "/calendar", permanent: false },
    ];
  },
};

export default nextConfig;
