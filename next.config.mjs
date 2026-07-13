/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tree-shake large barrel imports → smaller bundles + faster compiles.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
