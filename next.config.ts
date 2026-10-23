import type { NextConfig } from "next";

// Dados do pdfjs lidos do disco ao desenhar PDF no servidor (src/lib/questoes/pdf-servidor.ts).
const DADOS_PDFJS = [
  "./node_modules/pdfjs-dist/standard_fonts/**/*",
  "./node_modules/pdfjs-dist/cmaps/**/*",
  "./node_modules/pdfjs-dist/wasm/**/*",
];

const nextConfig: NextConfig = {
  // pdfjs (carrega o worker e o @napi-rs/canvas por import/require dinâmico) e o módulo nativo
  // do canvas precisam do require do Node, sem passar pelo bundler.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/mcp": DADOS_PDFJS,
    "/api/mcp/dono": DADOS_PDFJS,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/capas/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/marcas/**" },
    ],
  },
};

export default nextConfig;
