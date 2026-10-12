import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["192.168.2.12", "*.ngrok-free.app"],
};

export default nextConfig;
