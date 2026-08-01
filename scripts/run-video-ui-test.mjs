import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const HOST = "127.0.0.1";
const START_PORT = 3210;
const SMOKE_CLIENT_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "",
  NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY: "",
  NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN: "",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
  NEXT_PUBLIC_VIBECUT_EXPORT_MODE: "localMock",
};

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, HOST);
    };
    tryPort(startPort);
  });
}

async function waitForServer(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited early with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...SMOKE_CLIENT_ENV,
    },
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function findExistingNextUrl(output) {
  if (!output.includes("Another next dev server is already running")) return null;
  const matches = [...output.matchAll(/- Local:\s+(http:\/\/[^\s]+)/g)];
  return matches.at(-1)?.[1] || null;
}

const requestedSpecs = process.argv.slice(2);

function runPlaywright(baseUrl) {
  const playwrightCli = "node_modules/@playwright/test/cli.js";
  return spawnNode([
    playwrightCli,
    "test",
    ...(requestedSpecs.length > 0
      ? requestedSpecs
      /*
       * Phase 7: `smoke-video-ui.spec.cjs` couvrait l'ancien front, supprime.
       * La suite par defaut est desormais celle du nouveau front.
       */
      : [
          "scripts/smoke-vibecut-ui-v2.spec.cjs",
          "scripts/smoke-vibecut-quick-v2.spec.cjs",
          "scripts/smoke-vibecut-guided-v2.spec.cjs",
          "scripts/smoke-vibecut-advanced-v2.spec.cjs",
          "scripts/smoke-vibecut-library-v2.spec.cjs",
        ]),
    "--reporter=line",
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      SMOKE_BASE_URL: baseUrl,
    },
  });
}

const port = await findOpenPort(Number(process.env.SMOKE_PORT || START_PORT));
const baseUrl = `http://${HOST}:${port}`;
const nextBin = "node_modules/next/dist/bin/next";
const server = spawnNode([nextBin, "dev", "--hostname", HOST, "--port", String(port)]);
let serverOutput = "";

server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

const stopServer = () => {
  if (server.exitCode === null) server.kill("SIGTERM");
};

process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopServer();
  process.exit(143);
});

try {
  await waitForServer(`${baseUrl}/studio`, server);

  const test = runPlaywright(baseUrl);

  const exitCode = await new Promise((resolve) => {
    test.on("exit", (code) => resolve(code ?? 1));
  });
  stopServer();
  process.exit(exitCode);
} catch (error) {
  stopServer();
  const existingUrl = findExistingNextUrl(serverOutput);
  if (existingUrl) {
    const test = runPlaywright(existingUrl);
    const exitCode = await new Promise((resolve) => {
      test.on("exit", (code) => resolve(code ?? 1));
    });
    process.exit(exitCode);
  }
  console.error(error.message);
  if (serverOutput) {
    console.error("\n--- next dev output ---");
    console.error(serverOutput.slice(-4000));
  }
  process.exit(1);
}
