import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js blocks cross-origin requests to dev-only assets (/_next/webpack-hmr and
  // friends) from any host it wasn't started on. Phone testing goes through an ngrok
  // HTTPS tunnel — needed because getUserMedia only runs on HTTPS or localhost — so
  // the tunnel host has to be allowed or hot reload is refused over it.
  //
  // The wildcard is deliberate: free ngrok hostnames rotate on every restart, and
  // pinning one would mean editing this file each session. This only applies to
  // `next dev`; production builds ignore it entirely.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    // Same-Wi-Fi testing over plain HTTP, without a tunnel.
    "192.168.29.155",
  ],

  // sharp is in Next's default serverExternalPackages list, so it is `require`d
  // natively at runtime instead of bundled. Output file tracing uses @vercel/nft,
  // which finds files by statically analysing `import`, `require` and `fs` calls.
  //
  // sharp's prebuilt `sharp-linux-x64.node` does not `require` libvips — it links
  // against libvips-cpp.so.8.18.3 through an RPATH resolved by the OS dynamic
  // linker. nft cannot see that edge, so on Vercel the .node binary ships without
  // its shared library and the first sharp call dies with
  // `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file`.
  //
  // Forcing both @img packages into the trace for the two routes that touch sharp
  // (ocr-test → ocr.ts/image-prep.ts, ocr-scan → reconstruct-register.ts) fixes it.
  // Patterns that match nothing locally are a no-op, which is why the Windows
  // binaries are absent here: only the Linux build needs the help.
  outputFileTracingIncludes: {
    "/api/ocr-test": [
      "node_modules/@img/sharp-linux-x64/**/*",
      "node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/ocr-scan": [
      "node_modules/@img/sharp-linux-x64/**/*",
      "node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
