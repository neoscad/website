#!/bin/sh
# Installs NeoSCAD's command-line tool on macOS or Linux:
#
#   curl -LsSf https://neoscad.org/install.sh | sh
#
# It runs the installer published with the latest NeoSCAD release on
# GitHub (neoscad-cli-installer.sh, made by cargo-dist), which downloads
# that release's archive for this machine, checks it and installs
# `neoscad`. Arguments are passed on to it: `sh -s -- --help` lists them.
# The source and every release: https://github.com/neoscad/neoscad
set -eu
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/neoscad/neoscad/releases/latest/download/neoscad-cli-installer.sh | sh -s -- "$@"
