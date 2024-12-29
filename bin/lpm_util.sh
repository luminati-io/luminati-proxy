#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
PERR_URL="https://perr.lum-lpm.com/client_cgi/perr"
OS=""
OS_MAC=0
OS_LINUX=0
RS=""
LOG=""
LOGFILE=""
NETWORK_RETRY=3
IS_ROOT=0
if [ $(id -u) = 0 ]; then
    IS_ROOT=1
fi
LUM=0
VERSION="%VER%"
if [ -f  "/usr/local/hola/zon_config.sh" ]; then
    LUM=1
fi
TS_START=$(date +"%s000")
OS_RELEASE=$(uname -r)
# need to suppress fold stderr to not get Broken pipe errors as head finishes
# processing first
RID=$(head -80 /dev/urandom | LC_CTYPE=C tr -dc 'a-zA-Z0-9' | \
    fold -w 32 2> /dev/null | head -1)
SUDO_CMD="sudo -E env \"SHELL=/bin/bash\""
PRINT_ZERR=0

is_cmd_defined()
{
    local cmd=$1
    type -P "$cmd" > /dev/null
    return $?
}

check_sudo()
{
    if ((LUM)) && is_cmd_defined "rt" ; then
        SUDO_CMD=rt
    fi
    if ((IS_ROOT)); then
        SUDO_CMD=""
    fi
}

run_cmd()
{
    local cmd=$1 force_log=$2 err2out=$3
    echo -n > $LOGFILE
    if ((err2out)); then
        eval "$cmd" 2>&1>$LOGFILE>/dev/null;
    else
        eval "$cmd" 2>$LOGFILE>/dev/null;
    fi
    local ret=$?
    local error=$(tail -n 10 $LOGFILE | base64 2>&1)
    error=${error/$'\n'/ }
    if ((!ret&&!force_log)); then
        error=""
    fi
    local cmd_log=""
    if ((!ret)); then
        cmd_log="CMD $cmd: OK $error"
    else
        cmd_log="CMD $cmd: FAIL($ret) $error"
    fi
    zerr "$cmd_log"
    if [[ -z "$PRINT_ZERR" ]] && [[ -z "$error" ]]; then
        echo "$cmd_log"
    fi
    return $ret;
}

retry_cmd()
{
    local cmd=$1 force_log=$2 err2out=$3 ret=0
    for ((i=0; i<NETWORK_RETRY; i++)); do
        zerr "retry_cmd $cmd $i"
        run_cmd "$cmd" $force_log $err2out
        ret=$?
        if ((!ret)); then break; fi
    done
    return $ret
}

sudo_cmd()
{
    local cmd=$1 force_log=$2 err2out=$3
    run_cmd "$SUDO_CMD $cmd" $force_log $err2out
    return $?
}

retry_sudo_cmd()
{
    local cmd=$1 force_log=$2 err2out=$3 ret=0
    for ((i=0; i<NETWORK_RETRY; i++)); do
        zerr "retry_sudo_cmd $cmd $i"
        sudo_cmd "$cmd" $force_log $err2out
        ret=$?
        if ((!ret)); then break; fi
    done
    return $ret
}

escape_json()
{
    local strip_nl=${1//$'\n'/\\n}
    local strip_tabs=${strip_nl//$'\t'/\ }
    local strip_quotes=${strip_tabs//$'"'/\ }
    RS=$strip_quotes
}

zerr(){ LOG="$LOG$1\n"; }

perr()
{
    local name=$1 note="$2" ts=$(date +"%s") ret=0
    escape_json "$note"
    zerr "PERR $name"
    local note=$RS url="${PERR_URL}/?id=lpm_cert.${name}"
    local data="{\"uuid\": \"$RID\", \"timestamp\": \"$ts\", \"ver\": \"$VERSION\", \"info\": {\"platform\": \"$OS\", \"c_ts\": \"$ts\", \"c_up_ts\": \"$TS_START\", \"note\": \"$note\", \"lum\": $LUM, \"root\":$IS_ROOT, \"os_release\":\"$OS_RELEASE\"}}"
    for ((i=0; i<NETWORK_RETRY; i++)); do
        if is_cmd_defined "curl"; then
            curl -s -X POST "$url" --data "$data" \
                -H "Content-Type: application/json" > /dev/null
        elif is_cmd_defined "wget"; then
            wget -S --header "Content-Type: application/json" \
                 -O /dev/null -o /dev/null --post-data="$data" \
                 --quiet $url > /dev/null
        else
            echo "no transport to send perr"
        fi
        ret=$?
        if ((!ret)); then break; fi
    done
}

reset_luminati_symlink()
{
    local force_log=$1 err2out=$2
    if ! [ $(npm get prefix)/bin -ef /usr/local/bin ]; then
        if [ -f "/usr/local/bin/luminati" ]; then
            sudo_cmd "rm /usr/local/bin/luminati" $force_log $err2out
        fi
        sudo_cmd "ln -s $(npm get prefix)/bin/luminati /usr/local/bin/luminati" $force_log $err2out
        sudo_cmd "chmod a+x /usr/local/bin/luminati" $force_log $err2out
    fi
}

case "$(uname -s)" in
Linux*)
    OS=linux
    OS_LINUX=1
    ;;
Darwin*)
    OS=darwin
    OS_MAC=1
    ;;
CYGWIN*)
    OS=cygwin
    ;;
MINGW*)
    OS=mingw
    ;;
*)
    OS="$OS"
    ;;
esac

check_sudo
