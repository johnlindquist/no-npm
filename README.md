# Block npm Inside a Codex Project

This lesson demonstrates a project-local Codex configuration that makes `npm`
unavailable to shell commands Codex runs inside this repo.

The pattern is intentionally simple:

1. `.codex/config.toml` tells Codex to set `ZDOTDIR` for shell subprocesses.
2. Codex keeps its defaults for login shells, shell snapshots, and environment
   inheritance.
3. zsh reads startup files from `.codex/zsh`.
4. `.codex/zsh/.zshenv` and `.codex/zsh/.zprofile` prepend `.codex/bin` to
   `PATH`.
5. `.codex/bin/npm` appears before the real `npm`, so scripts that run `npm`
   by name hit the blocker.
6. `.codex/rules/no-npm.rules` tells Codex execpolicy to reject agent/model
   shell commands that invoke `npm`, including absolute paths that resolve to
   an npm executable.

This blocks `npm` when code launches it through `PATH`, such as:

```js
spawn("npm", ["install"])
```

It does not block a script that intentionally runs an absolute path such as
`/opt/homebrew/bin/npm`. The execpolicy layer covers Codex agent/model shell
commands, not arbitrary local child processes or direct user shell commands.
Use a container or OS-level sandbox when you need that level of enforcement.

## File Tree

```text
.
├── .codex/
│   ├── bin/
│   │   └── npm
│   ├── rules/
│   │   └── no-npm.rules
│   ├── zsh/
│   │   ├── .zprofile
│   │   └── .zshenv
│   └── config.toml
├── AGENTS.md
├── LESSON_PROMPT.md
├── README.md
└── test-npm.js
```

## Local Proof Without Codex

Run this from the lesson directory:

```sh
ZDOTDIR="$PWD/.codex/zsh" \
zsh -lc 'command -v npm; node ./test-npm.js; echo script-exit=$?'
```

Expected result:

```text
/Users/.../lessons/codex/no-npm/.codex/bin/npm
/Users/.../lessons/codex/no-npm/.codex/bin/npm
npm is disabled inside this Codex project environment.
Do not choose a replacement automatically. Ask the user whether they want pnpm, bun, or another approach.
Common replacements: pnpm install/add/run, bun install/add/run.
script-exit=127
```

The duplicate path is expected. The test script first asks `which npm`, then
attempts to run `npm --version`.

## Codex Proof

After trusting this project in Codex, run:

```sh
codex exec -C "$PWD" --skip-git-repo-check --sandbox read-only \
  'Run exactly this shell command and report stdout/stderr and exit code: zsh -lc '"'"'command -v npm; node ./test-npm.js; echo script-exit=$?'"'"''
```

Expected result: Codex should report that `npm` resolves to `.codex/bin/npm`,
and the script should end with `script-exit=127`.

Do not use `--ignore-user-config` for this proof if your trust entry for the
project lives in `~/.codex/config.toml`; skipping user config can also skip the
trust entry that allows project `.codex/config.toml` to load.

## Full-Path npm Proof For Agent Commands

The PATH shim cannot catch this by itself:

```sh
/usr/local/bin/npm --version
```

That command names the executable directly, so there is no `PATH` lookup for
zsh to influence.

The project-local Codex execpolicy rule covers this case for Codex agent/model
shell commands:

```starlark
prefix_rule(
    pattern = ["npm"],
    decision = "forbidden",
    justification = "npm is disabled in this demo. Ask whether to use pnpm, bun, or another package manager instead.",
)
```

You can test the rule directly:

```sh
codex execpolicy check \
  --rules .codex/rules/no-npm.rules \
  --resolve-host-executables \
  --pretty \
  /usr/local/bin/npm --version
```

Expected result: the JSON decision is `forbidden`, with `resolvedProgram` set to
`/usr/local/bin/npm`.

You can also test actual Codex agent execution:

```sh
codex exec -C "$PWD" --skip-git-repo-check --sandbox read-only \
  'Run exactly this shell command and report stdout/stderr and exit code: /usr/local/bin/npm --version'
```

Expected result: Codex rejects the command before launch. There is no process
exit code because npm never runs.

This is different from a direct user shell command in interactive Codex. If you
type a shell escape such as:

```sh
! /usr/local/bin/npm --version
```

that is an explicit user-invoked shell command. Today, that path bypasses
Codex execpolicy, so the real npm binary can still run. To block that too,
Codex would need to apply execpolicy to direct user shell commands, or the
environment would need OS/container-level enforcement.

## Why Use `ZDOTDIR`

On macOS, Codex shell commands typically run through zsh. `ZDOTDIR` tells zsh
where to look for most of its startup files. By pointing `ZDOTDIR` at
`.codex/zsh`, the project gets a tiny Codex-only zsh startup area without
touching `~/.zshrc`.

The project-local zsh startup files update `PATH`:

```zsh
export PATH="$PWD/.codex/bin:$PATH"
```

That one line is the core idea: put this project's shim directory before the
real system command directories.

In the current demo, that line lives directly in both `.codex/zsh/.zshenv` and
`.codex/zsh/.zprofile`.

## Which zsh Files Codex Loads

This project relies on how Codex launches shell commands under this
project-local Codex configuration and the local Codex source checkout.

The only project setting this demo needs is:

```toml
[shell_environment_policy.set]
ZDOTDIR = ".codex/zsh"
```

Codex defaults `allow_login_shell` to `true`, so shell commands default to login
shells unless a user or project config overrides that behavior. For zsh, bash,
and sh, the Codex source builds login commands as:

```text
<shell> -lc <command>
```

On this machine, the user shell is zsh, so the effective shape is:

```text
/bin/zsh -lc '<command>'
```

That is a non-interactive login shell. For zsh, the startup-file order this demo
depends on is:

```text
.zshenv
.zprofile
.zlogin
```

`.zshrc` does not load because the shell is not interactive. `.zlogout` is for
login shell exit and is not part of the setup path this demo depends on.

The `.zprofile` repeat is intentional. A login zsh shell reads `.zshenv`, then
later login startup code can rewrite `PATH` on macOS. Since this demo directly
changes `PATH` in project zsh startup files for simplicity's sake, `.zprofile`
re-applies the same prepend after that login setup.

Because this project sets `ZDOTDIR`, zsh looks in `.codex/zsh` instead of the
user's home directory. In this demo, Codex's login shell reads:

```text
.codex/zsh/.zshenv
.codex/zsh/.zprofile
```

Only these tiny project-local startup files are needed here, because the npm
blocker only needs a small `PATH` change.

## Shell Snapshots

This demo does not configure shell snapshots. It leaves that at the Codex
default, matching a normal setup. When snapshots are enabled by default or by a
user's global config, Codex can capture a shell environment and reuse that
captured environment for later commands in the same working directory.

Practically, this demo's important startup-file effect is still the same:
the project zsh startup files put `.codex/bin` before the real command
directories. A later command may receive that effect from the snapshot rather
than from re-reading the startup files every time.

The source-level flow in `~/dev/codex` is:

- omitted `login` defaults to the config value
- Codex defaults `allow_login_shell` to `true`, so omitted `login` defaults to
  login unless the user's config changes it
- zsh/bash/sh login commands are built with `-lc`
- direct `PATH` changes in `.codex/zsh/.zshenv` and `.codex/zsh/.zprofile` are
  visible to the command

## What This Does Not Do

This lesson blocks `npm` by controlling `PATH`.

That is enough for common scripts and agent-generated shell commands, but it is
not a security boundary against hostile code. A script can bypass this with an
absolute executable path.

Project zsh startup files cannot reliably stop a child process that directly
execs the full path to the real npm binary, such as `/opt/homebrew/bin/npm` or
`/usr/local/bin/npm`. At that point there is no `PATH` lookup left for zsh to
influence. This demo uses Codex execpolicy for that case only when the command
is evaluated as a Codex agent/model shell command.

For stronger enforcement, use one of these:

- Codex execpolicy for Codex agent/model shell commands
- a Codex code change that applies execpolicy to direct user shell commands
- a devcontainer that does not install `npm`
- an OS sandbox that denies access to the real `npm` binary
- a CI/container environment with an allow-listed toolchain

## Extending the Pattern

To block another command, add another executable file under `.codex/bin`.

For example, you could add `.codex/bin/npx` because `npx` commonly ships with
npm and is often used to run install-time tooling.

The `npx` replacements depend on what the command was trying to do:

- Use `pnpm exec <command>` or `bun run <command>` for project-local binaries.
- Use `pnpm dlx <package>` or `bunx <package>` for temporary package execution.

You could add similar blockers for `pnpm`, `yarn`, `git`, or any other command
you want the Codex project environment to intercept.

## Resources

These are the references used while building this lesson.

### Codex Configuration

- [Config basics](https://developers.openai.com/codex/config-basic)
- [Advanced configuration](https://developers.openai.com/codex/config-advanced)
- [Configuration reference](https://developers.openai.com/codex/config-reference)
- [Sample configuration](https://developers.openai.com/codex/config-sample)
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference)
- [Agent approvals and security](https://developers.openai.com/codex/agent-approvals-security)

### Codex Source

- [shell_snapshot.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/shell_snapshot.rs)
- [shell.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/shell.rs)
- [shell_command.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/tools/handlers/shell/shell_command.rs)
- [exec_env.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/exec_env.rs)
- [runtimes/mod.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/tools/runtimes/mod.rs)
- [runtimes/shell.rs](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/src/tools/runtimes/shell.rs)

### Shell Startup Files

- [zsh startup files intro](https://zsh.sourceforge.io/Intro/intro_3.html)
- [zsh files documentation](https://zsh.sourceforge.io/Doc/Release/Files.html)
- [Bash startup files](https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files.html)

### Related Caveat

- [OpenAI Codex issue: zsh shell snapshot / PATH caveat](https://github.com/openai/codex/issues/20220)
