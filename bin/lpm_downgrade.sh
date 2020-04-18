#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
DIR=$(dirname "$0")
. "$DIR/lpm_util.sh"
LOGFILE=$1

main()
{
    if ! [ -d "$(npm root -g)/@luminati-io/luminati-proxy.old" ]; then
        perr "downgrade_no_backup"
        exit 1
    fi
    sudo_cmd "rm -rf $(npm root -g)/@luminati-io/luminati-proxy" 0 1
    sudo_cmd "mv $(npm root -g)/@luminati-io/luminati-proxy.old $(npm root -g)/@luminati-io/luminati-proxy" 0 1
    reset_luminati_symlink 0 1
    perr "downgrade_success_lpm"
}

main
