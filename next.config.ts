import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // PGlite (local development database) ships its own WebAssembly; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The Highlights tab used to be called Clip Farmer.
  async redirects() {
    return [{ source: "/clips", destination: "/highlights", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
