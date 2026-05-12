# zsh reads `.zprofile` for login shells after `.zshenv`.
#
# Codex normally runs zsh commands as non-interactive login shells. On macOS,
# login startup can rewrite PATH after `.zshenv`, so repeat the direct PATH
# prepend here to keep the project shim directory first.
#
# This intentionally stays simple instead of sourcing a separate shared zsh
# file.
export PATH="$PWD/.codex/bin:$PATH"
