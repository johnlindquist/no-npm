# zsh reads `.zshenv` for every zsh invocation unless zsh is started with `-f`.
#
# This demo changes PATH directly here for simplicity's sake. Codex's standard
# path uses a login shell, so `.zprofile` repeats the same prepend after macOS
# login startup has had a chance to rewrite PATH.
#
# This is a PATH shim, not a complete security sandbox.
export PATH="$PWD/.codex/bin:$PATH"
