/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb', // allow emergency media uploads
    },
  },
};

module.exports = nextConfig;
