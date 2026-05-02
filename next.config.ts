import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve ?? {};

    // Vendored bureau-ui sources use NodeNext-style imports
    // (`./foo.js` resolving to `./foo.tsx` source). Webpack only honors
    // those mappings when `extensionAlias` is configured.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias as Record<string, string[]> | undefined),
      ".js": [".ts", ".tsx", ".js"],
    };

    // The `@sizls/pluck-bureau-*` packages depend on `@sizls/pluck` core,
    // which has dynamic imports for optional peer deps (sharp, playwright,
    // database drivers, etc.). Studio doesn't use any of these at runtime —
    // they get walked by webpack's module graph during build. Alias them to
    // `false` to short-circuit resolution.
    //
    // CAVEAT: These stubs are safe ONLY because Studio doesn't reference
    // these deps at runtime. If a future Studio feature needs any of
    // these (e.g. sharp for an image pipeline, ioredis for a cache layer),
    // remove the corresponding alias — and that feature must be implemented
    // in a way Studio actually uses, not pulled transitively from bureau-*.
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, false | string> | undefined),
      // Browser automation
      "playwright-core": false,
      playwright: false,
      "@playwright/test": false,
      electron: false,
      "chromium-bidi": false,
      "chromium-bidi/lib/cjs/bidiMapper/BidiMapper": false,
      "chromium-bidi/lib/cjs/cdp/CdpConnection": false,
      // Image processing / OCR / ML
      sharp: false,
      "tesseract.js": false,
      "face-api.js": false,
      "@xenova/transformers": false,
      // DB / cache / brokers
      ioredis: false,
      kafkajs: false,
      mongodb: false,
      mysql2: false,
      pg: false,
      "better-sqlite3": false,
      // Network protocols
      ssh2: false,
      "basic-ftp": false,
      ws: false,
      imap: false,
      "node-imap": false,
      mqtt: false,
      // gRPC
      "@grpc/grpc-js": false,
      "@grpc/proto-loader": false,
      // AWS
      "@aws-sdk/client-s3": false,
      "@aws-sdk/client-secrets-manager": false,
      // Data formats
      avsc: false,
      protobufjs: false,
    };

    // The CUSTODY verifier reaches into `node:crypto` / `node:fs`.
    // The browser bundle never executes this code (it's behind a
    // dynamic import gated on a user file-drop event), but webpack
    // still threads the module graph and needs `fs` / `crypto` to
    // resolve. Stub them as empty modules on the client.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback as Record<string, false> | undefined),
        fs: false,
        "node:fs": false,
        crypto: false,
        "node:crypto": false,
        path: false,
        "node:path": false,
        os: false,
        "node:os": false,
        tls: false,
        "node:tls": false,
        net: false,
        "node:net": false,
        dgram: false,
        "node:dgram": false,
        dns: false,
        "node:dns": false,
        http2: false,
        "node:http2": false,
        child_process: false,
        "node:child_process": false,
        worker_threads: false,
        "node:worker_threads": false,
        zlib: false,
        "node:zlib": false,
        events: false,
        "node:events": false,
        stream: false,
        "node:stream": false,
        buffer: false,
        "node:buffer": false,
        util: false,
        "node:util": false,
        url: false,
        "node:url": false,
      };
    }

    return config;
  },

  // Vanity rewrites – `studio.pluck.run/dragnet/...` resolves to the
  // canonical `/bureau/dragnet/...` route. Every shared link is a
  // Pluck Bureau ad.
  async rewrites() {
    const programs = [
      "dragnet",
      "tripwire",
      "oath",
      "fingerprint",
      "nuclei",
      "sbom-ai",
      "rotate",
      "mole",
      "whistle",
      "bounty",
      "custody",
    ];

    return programs.map((p) => ({
      source: `/${p}/:path*`,
      destination: `/bureau/${p}/:path*`,
    }));
  },
};

export default nextConfig;
