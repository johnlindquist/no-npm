# AGENTS.md

This directory is a Codex lesson demo, not an npm project.

The demo shows how a project-local Codex config can alter the shell environment
Codex sees without changing the user's normal shell setup. The concrete example
blocks `npm` by putting `.codex/bin` first in `PATH`, where `.codex/bin/npm` is
a blocker script.

Key points to preserve:

- `.codex/config.toml` sets `ZDOTDIR = ".codex/zsh"` for Codex shell commands.
- This demo does not set `allow_login_shell`, `features.shell_snapshot`, or
  `[shell_environment_policy] inherit`; it leaves Codex defaults alone.
- With the standard default, Codex follows its non-interactive login-shell path.
- The relevant zsh startup files are `.zshenv` and `.zprofile`.
- `.zshrc` is not part of this demo because Codex shell commands are not
  interactive shells.
- The demo keeps the PATH change directly in `.codex/zsh/.zshenv` and
  `.codex/zsh/.zprofile` for simplicity's sake, instead of sourcing a separate
  shared zsh file.
- `.zprofile` repeats the PATH prepend because macOS login startup can rewrite
  PATH after `.zshenv`.
- Shell snapshots may cause later Codex commands to reuse the captured startup
  effects instead of re-reading the zsh files on every command.

When editing this lesson, keep it small and inspectable. Do not add package
manager metadata or a real `npm install` path. If you add another blocked
command, add a shim under `.codex/bin` and update `README.md` with a proof
command.
