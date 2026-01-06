#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
DIR=$(dirname "$0")
. "$DIR/lpm_util.sh"

if [[ -n "$1" ]]; then
    LOGFILE="$1"
fi

main()
{
    # Resolve npm root
    local rootdir
    rootdir=$($SUDO_CMD bash -lc 'npm root -g' 2>/dev/null)
    if [[ -z "$rootdir" ]]; then
        rootdir=$(npm root -g 2>/dev/null)
    fi

    # Create version backup to be possibly used by lpm_downgrade.sh (ignore if not present)
    sudo_cmd "[ -d \"$rootdir/@luminati-io/luminati-proxy\" ] && rm -rf \"$rootdir/@luminati-io/luminati-proxy.old\" && mv \"$rootdir/@luminati-io/luminati-proxy\" \"$rootdir/@luminati-io/luminati-proxy.old\"" 0 1

    retry_sudo_cmd "npm install -g --unsafe-perm --force --loglevel error @luminati-io/luminati-proxy" 0 1
    if (($?)); then
        perr "upgrade_error_lpm"
        exit 1
    fi
    reset_luminati_symlink 0 1
    perr "upgrade_success_lpm"
}

main
