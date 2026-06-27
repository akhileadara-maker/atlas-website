/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist references the optional, Node-only `canvas` module on a code
    // path we never hit (we only extract text in the browser). Stub it so the
    // client bundle doesn't fail to resolve it.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
