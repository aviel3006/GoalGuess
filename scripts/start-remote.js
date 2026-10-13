#!/usr/bin/env node

/**
 * Starts the dev server behind a free Cloudflare quick tunnel, so Expo Go can open
 * the app from any network (the phone doesn't need to be on the home Wi-Fi).
 * Expo's own `--tunnel` relies on a shared ngrok account that is often overloaded.
 * The computer still has to stay on while the app is in use.
 *
 * Extra arguments go to `expo start`. `npm run share` passes --no-dev --minify, so friends
 * testing in Expo Go get the faster production bundle, and prints a link they can tap.
 * Expo Go on iPhone opens the project only for Expo accounts with access to it, so friends join
 * the "goalguess" Expo organization as Viewers and sign in to Expo Go. The CLI must stay signed
 * in (no --offline) so the manifest is signed for that organization.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const SHARE_PAGE = "https://aviel3006.github.io/GoalGuess/try.html";

// An older dev server may still hold 8081; tunnelling to it would serve its LAN-only address
function findFreePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(findFreePort(port + 1)));
    server.once("listening", () => server.close(() => resolve(port)));
    server.listen(port);
  });
}

// cloudflared is not on the PATH: it is either downloaded to %LOCALAPPDATA% or installed by winget
function findCloudflared() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "cloudflared", "cloudflared.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "cloudflared", "cloudflared.exe"),
    path.join(process.env.ProgramFiles || "", "cloudflared", "cloudflared.exe"),
  ];
  return candidates.find((file) => fs.existsSync(file)) || "cloudflared";
}

async function main() {
  const port = await findFreePort(Number(process.env.PORT) || 8081);
  if (port !== 8081) console.log(`פורט 8081 תפוס (כנראה שרת ישן שעדיין רץ), משתמש בפורט ${port}`);

  const tunnel = spawn(findCloudflared(), ["tunnel", "--url", `http://localhost:${port}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  tunnel.on("error", () => {
    console.error("תוכנת החיבור cloudflared לא מותקנת");
    process.exit(1);
  });

  let expo = null;

  function onTunnelOutput(chunk) {
    if (expo) return;
    const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!url) return;

    console.log(`החיבור המרוחק מוכן: ${url[0]}`);
    // docs/try.html turns the tunnel host into an exp:// link that opens Expo Go
    console.log(`קישור לחברים: ${SHARE_PAGE}#${new URL(url[0]).host}`);
    const extraArgs = process.argv.slice(2).join(" ");
    expo = spawn(`npx expo start --port ${port} ${extraArgs}`, {
      stdio: "inherit",
      shell: true,
      // Must be set in the shell: Expo reads it before loading .env
      env: { ...process.env, EXPO_PACKAGER_PROXY_URL: url[0] },
    });
    expo.on("exit", (code) => {
      tunnel.kill();
      process.exit(code ?? 0);
    });
  }

  tunnel.stdout.on("data", onTunnelOutput);
  tunnel.stderr.on("data", onTunnelOutput);

  tunnel.on("exit", (code) => {
    if (!expo) {
      console.error(`החיבור המרוחק נסגר (${code}) לפני שהיה מוכן. נסה שוב.`);
      process.exit(1);
    }
  });

  process.on("SIGINT", () => {
    tunnel.kill();
    expo?.kill();
    process.exit(0);
  });
}

main();
