#!/usr/bin/env node

/**
 * Publishes the current code as an EAS Update on the "friends" channel with Expo Go's runtime
 * version, so friends can open it in Expo Go from https://aviel3006.github.io/GoalGuess/try.html
 * without the computer staying on. Unlike a dev server, a published update opens on iPhone
 * for any Expo Go user, not only the account that runs Expo CLI.
 */

const { spawnSync } = require("child_process");

const message = process.argv.slice(2).join(" ") || "גרסת ניסיון לחברים";

const result = spawnSync(
  `npx eas-cli@latest update --channel friends --environment preview --platform all --non-interactive --message "${message.replace(/"/g, "'")}"`,
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, EXPO_GO_UPDATE: "1" },
  }
);

if (result.status === 0) {
  console.log("\nהגרסה עלתה. הקישור לחברים: https://aviel3006.github.io/GoalGuess/try.html");
}
process.exit(result.status ?? 1);
