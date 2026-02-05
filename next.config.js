/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "subsnacks.sirv.com",
      },
    ],
  },
};

module.exports = nextConfig;
