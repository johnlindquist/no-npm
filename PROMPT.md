# Lesson Prompt: Set Up a Codex Project That Blocks npm

Copy and paste this prompt into Codex from a new empty project directory.

```text
Create a project-local Codex setup that blocks npm for commands Codex runs in this repo.

Requirements:

1. Create `.codex/config.toml`.
   - Do not set `allow_login_shell`; use the Codex default.
   - Do not set `features.shell_snapshot`; use the Codex default.
   - Do not set `[shell_environment_policy] inherit`; use the Codex default.
   - Set `[shell_environment_policy.set] ZDOTDIR = ".codex/zsh"` so zsh uses a project-local startup directory.

2. Create `.codex/zsh/.zshenv` and `.codex/zsh/.zprofile`.
   - Both files should directly prepend `$PWD/.codex/bin` to `PATH` with `export PATH="$PWD/.codex/bin:$PATH"`.
   - Add comments explaining that `.zshenv` runs for every zsh invocation unless zsh is started with `-f`.
   - Add comments explaining that `.zprofile` runs later for login shells and re-applies the PATH shim after macOS/login startup may modify PATH.
   - Add comments explaining that this demo changes `PATH` directly in those project zsh startup files for simplicity's sake, instead of sourcing a separate shared zsh file.
   - Add comments explaining that this is a PATH shim, not a complete security sandbox.

3. Create `.codex/bin/npm`.
   - Make it a shell script with a shebang.
   - It should print a clear warning to stderr:
     - `npm is disabled inside this Codex project environment.`
     - `Do not choose a replacement automatically. Ask the user whether they want pnpm, bun, or another approach.`
     - `Common replacements: pnpm install/add/run, bun install/add/run.`
   - It should exit with code `127`.

4. Create `.codex/rules/no-npm.rules`.
   - Add a `prefix_rule` with `pattern = ["npm"]`.
   - Set `decision = "forbidden"`.
   - Set a justification telling the agent to ask whether to use pnpm, bun, or another package manager instead.
   - Explain in comments that Codex execpolicy can catch absolute npm paths for agent/model shell commands when host executable resolution is enabled.

5. Create `test-npm.js`.
   - Use Node's `child_process.spawn`.
   - First run `which npm`.
   - If `which npm` succeeds, run `npm --version`.
   - Exit with the child command's exit code.
   - Add comments explaining that spawned child processes do not see shell functions, so an executable PATH shim is required.

6. Create `README.md`.
   - Explain the goal.
   - Show the file tree.
   - Explain the `ZDOTDIR` flow.
   - Explain that the project config only sets `ZDOTDIR` and leaves Codex defaults alone.
   - Explain that the demo changes `PATH` directly in `.codex/zsh/.zshenv` and `.codex/zsh/.zprofile` for simplicity's sake.
   - Explain how `.codex/bin/npm` blocks PATH-based npm calls.
   - Explain how `.codex/rules/no-npm.rules` blocks Codex agent/model shell commands that invoke npm through an absolute path.
   - Include local verification:
     `ZDOTDIR="$PWD/.codex/zsh" zsh -lc 'command -v npm; node ./test-npm.js; echo script-exit=$?'`
   - Include Codex verification:
     `codex exec -C "$PWD" --skip-git-repo-check --sandbox read-only 'Run exactly this shell command and report stdout/stderr and exit code: zsh -lc '"'"'command -v npm; node ./test-npm.js; echo script-exit=$?'"'"''`
   - Include execpolicy verification:
     `codex execpolicy check --rules .codex/rules/no-npm.rules --resolve-host-executables --pretty /usr/local/bin/npm --version`
   - Clearly state the caveat that absolute paths can bypass a PATH shim.
   - Clearly state that direct user shell commands in interactive Codex are outside the execpolicy path today, so `! /usr/local/bin/npm --version` can still run.
   - Explain that blocking direct user shell commands too requires a Codex code change, a container, or an OS-level sandbox.

7. Make `.codex/bin/npm` executable.

After creating the files, run the local verification command and report whether `npm` resolves to `.codex/bin/npm` and whether the script exits with `127`.
```

## Instructor Notes

The key teaching moment is that shell functions are not enough.

If a user adds this to a zsh rc file:

```zsh
npm() {
  echo "npm is disabled"
  return 127
}
```

then an interactive shell call to `npm` is blocked, but a Node script that calls
`spawn("npm", ...)` will not see that function. Child processes resolve
executables through `PATH`, so the reliable demo is an executable shim:

```text
.codex/bin/npm
```

Then put `.codex/bin` first in `PATH`.

This is a practical project-level guardrail, not a complete security boundary.
Use it to stop accidental or agent-generated npm usage, not malicious code.
