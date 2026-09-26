import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      // The Dashboard became the Planner; keep old links and bookmarks working.
      { source: "/dashboard", destination: "/planner", permanent: false },
    ];
  },
};

export default nextConfig;
