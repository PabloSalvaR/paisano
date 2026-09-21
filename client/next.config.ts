import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false, // no generar client/AGENTS.md ni client/CLAUDE.md: el CLAUDE.md que manda es el de la raíz
};

export default nextConfig;
