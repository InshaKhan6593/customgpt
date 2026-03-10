import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: process.cwd(),
}

export default nextConfig
