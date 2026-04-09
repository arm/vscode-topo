#!/bin/bash

SCRIPT=$(basename "$0")
PLATFORMS=(win32-x64 win32-arm64 linux-x64 linux-arm64 darwin-x64 darwin-arm64)

set -eo pipefail

function usage() {
    echo "Usage: ${SCRIPT} <target_platform>"
    echo "  <target_platform> is one of:"
    printf "    - %s\n" "${PLATFORMS[@]}"

}

function download_tools() {
    npm run download -- --target "$1"
}

if [[ $# -ne 1 || ! " ${PLATFORMS[*]} " =~ [[:space:]]$1[[:space:]] ]] ; then
    usage
    exit 1
fi

download_tools "$1" 
