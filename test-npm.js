#!/usr/bin/env node

// This script proves why an executable PATH shim is stronger than a shell
// function for this lesson.
//
// A zsh function named `npm` would block someone typing `npm` in that shell,
// but Node's `spawn("npm", ...)` does not know about shell functions. It asks
// the operating system to resolve an executable named `npm` through PATH.
//
// That is why the lesson creates `.codex/bin/npm` and puts `.codex/bin` first
// in PATH.

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const run = async (command, args) => {
  try {
    const { stdout, stderr } = await execFile(command, args);
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    return 0;
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);

    if (typeof error.code === "number") {
      return error.code;
    }

    console.error(`Failed to run ${command} ${args.join(" ")}: ${error.message}`);
    return 1;
  }
};

// `which npm` should print this project's `.codex/bin/npm` path when the
// Codex zsh startup files have loaded.
const whichCode = await run("which", ["npm"]);

if (whichCode === 0) {
  // If the shim is first in PATH, this exits 127 and prints the blocker message.
  process.exitCode = await run("npm", ["--version"]);
} else {
  process.exitCode = whichCode;
}
