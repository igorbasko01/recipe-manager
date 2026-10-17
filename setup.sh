#!/bin/sh
# One-time setup for a fresh clone: use the repo's git hooks.
set -e

git config core.hooksPath .githooks
chmod +x .githooks/*
echo "Git hooks installed from .githooks/"
