#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
DIR=$(dirname "$0")
. "$DIR/lpm_util.sh"
LOGFILE=$1

main()
{
    # create version backup to be possibly used by lpm_downgrade.sh
    sudo_cmd "mv $(npm root -g)/@luminati-io/luminati-proxy $(npm root -g)/@luminati-io/luminati-proxy.old" 0 1
    retry_sudo_cmd "npm install -g --unsafe-perm --force --loglevel error @luminati-io/luminati-proxy" 0 1
    if (($?)); then
        perr "upgrade_error_lpm"
        exit 1
    fi
    reset_luminati_symlink 0 1
    perr "upgrade_success_lpm"
}

main
