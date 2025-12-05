/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.amazon.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.media-amazon.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.s3.**.amazonaws.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'p16-sign-va.tiktokcdn.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'p16-tiktokcdn-com.akamaized.net',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.akamaized.net',
        port: '',
        pathname: '/**/tiktokcdn-com/**'
      },
      {
        protocol: 'https',
        hostname: 'www.tiktok.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'tiktok.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: '**.tiktok.com',
        port: ''
      }
    ],
    // Allow unoptimized images for external domains that might not support optimization
    unoptimized: false
  }
};

export default nextConfig;
