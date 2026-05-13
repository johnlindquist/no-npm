---
name: codex-npm-block
description: Use when setting up or maintaining a project-local Codex demo that blocks npm by placing a repo-local executable shim earlier in PATH, with Codex execpolicy covering agent/model absolute npm invocations.
---

# Codex npm Block

Use this skill when a project should block accidental `npm` use for Codex-run
commands without becoming an npm project.

## Preserve The Demo Shape

- Keep the project small and inspectable.
- Do not add `package.json`, lockfiles, or a real install path.
- Put executable command shims under `.codex/bin/`.
- Put Codex-only zsh startup files under `.codex/zsh/`.
- Keep the PATH prepend directly in `.codex/zsh/.zshenv` and
  `.codex/zsh/.zprofile`; do not factor it into a shared zsh file for this
  lesson.
- Do not use `.zshrc`; Codex shell commands are non-interactive shells.

## Required Files

Create or maintain these files:

- `.codex/config.toml`
  - Set `[shell_environment_policy.set]`.
  - Set `ZDOTDIR = ".codex/zsh"`.
  - Do not set `allow_login_shell`, `features.shell_snapshot`, or
    `[shell_environment_policy] inherit`.
- `.codex/zsh/.zshenv`
  - Include `export PATH="$PWD/.codex/bin:$PATH"`.
  - Explain that `.zshenv` runs for every zsh invocation unless zsh uses `-f`.
- `.codex/zsh/.zprofile`
  - Repeat `export PATH="$PWD/.codex/bin:$PATH"`.
  - Explain that login startup on macOS can rewrite PATH after `.zshenv`.
- `.codex/bin/npm`
  - Make it executable.
  - Print a clear warning to stderr.
  - Exit `127`.
- `.codex/rules/no-npm.rules`
  - Add a `prefix_rule` for `pattern = ["npm"]`.
  - Use `decision = "forbidden"`.
  - Tell the agent to ask whether to use `pnpm`, `bun`, or another package
    manager instead.

## Shim Script Contract

The npm shim should be a real executable, not a shell function. Child processes
such as `node` with `child_process.spawn("npm", ...)` do not see shell
functions, but they do resolve executables through `PATH`.

Use this behavior:

```sh
#!/usr/bin/env sh
cat >&2 <<'EOF'
npm is disabled inside this Codex project environment.
Do not choose a replacement automatically. Ask the user whether they want pnpm, bun, or another approach.
Common replacements: pnpm install/add/run, bun install/add/run.
EOF
exit 127
```

## Verification

Run the local proof from the project root:

```sh
ZDOTDIR="$PWD/.codex/zsh" \
zsh -lc 'command -v npm; node ./test-npm.js; echo script-exit=$?'
```

Expected:

- `npm` resolves to `.codex/bin/npm`.
- The shim warning appears.
- The script exits with `127`.

For the execpolicy layer, check an absolute npm path when one exists:

```sh
codex execpolicy check \
  --rules .codex/rules/no-npm.rules \
  --resolve-host-executables \
  --pretty \
  /usr/local/bin/npm --version
```

Expected: the decision is `forbidden`, with the npm executable resolved by
Codex host executable resolution.

## Caveats To State In Docs

- The PATH shim blocks PATH-based npm calls, not arbitrary absolute paths from
  local child processes.
- Codex execpolicy covers agent/model shell commands, including absolute npm
  paths when host executable resolution is enabled.
- Direct user shell escapes in interactive Codex are outside that execpolicy
  path today.
- Shell snapshots may reuse captured startup effects instead of re-reading the
  zsh startup files on every command.
