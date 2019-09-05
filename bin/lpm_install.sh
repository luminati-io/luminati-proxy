#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
PERR_URL="https://perr.lum-lpm.com/client_cgi/perr"
ACTION="setup"
IS_ROOT=0
if [ $(id -u) = 0 ]; then
    IS_ROOT=1
fi
LUM=0
VERSION="1.151.510"
if [ -f  "/usr/local/hola/zon_config.sh" ]; then
    LUM=1
fi
RID=$(cat /dev/urandom | LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 |\
    head -n 1)
TS_START=$(date +"%s000")
OS_RELEASE=$(uname -r)
INSTALL_NODE=0
INSTALL_WGET=0
INSTALL_NPM=0
INSTALL_CURL=0
INSTALL_BREW=0
USE_NVM=0
NODE_VER='10.16.3'
NPM_VER='6.4.1'
NETWORK_RETRY=3
NETWORK_ERROR=0
UPDATE_NODE=0
UPDATE_NPM=0
REINSTALL_NODE_MAC=0
OS=""
OS_MAC=0
OS_LINUX=0
ASSUME_YES=0
SUDO_CMD="sudo -E env \"SHELL=/bin/bash\""
NVM_DIR="$HOME/.nvm"
LOGFILE="/tmp/lpm_install_$RID.log"
LOG=""
RS=""

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

WGET_FLAG=""

if ((OS_MAC)); then
    WGET_FLAG='--compression=none'
fi

is_cmd_defined()
{
    local cmd=$1
    type -P "$cmd" > /dev/null
    return $?
}

is_fn_defined()
{
    local fn=$1
    command -v "$fn" > /dev/null
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

escape_json()
{
    local strip_nl=${1//$'\n'/\\n}
    local strip_tabs=${strip_nl//$'\t'/\ }
    local strip_quotes=${strip_tabs//$'"'/\ }
    RS=$strip_quotes
}

usage()
{
    echo "usage: $0 [OPTIONS] [ACTION=setup]"
    echo
    echo "OPTIONS:"
    echo "  -y            - assume yes on prompts"
    echo "  --no-perr     - don't send perrs to server"
    echo "  --print-perr  - print perrs to console"
    echo "ACTION:"
    echo "  setup         - setup lpm (DEFAULT)"
    echo "  clean         - clean cache and lpm related files"
    echo "  dev-setup     - attempt to clean any traces of lpm and it's"
    echo "                  dependencies"
    echo "                  WARNING: be careful, attempts to delete"
    echo "                           - several system packages"
    echo "                           - all node packages"
    exit 1
}

prompt()
{
    if ((ASSUME_YES)); then
        return 0
    fi
    local question=$1
    local answer=$2
    local yn="y/N";
    local color='\e[1;31m'
    if [[ -z "$answer" ]]; then
        echo "ANSWER y"
        answer=y
    fi
    if [[ $answer =~ ^(y|Y|)$ ]]; then
        yn="Y/n"
        color='\e[1;32m'
    fi
    local default=$answer
    if [[ -t 0 ]]; then
        if ((!OS_MAC)); then
            echo -e -n "$color"
        fi
        read -n 1 -p $"$question ($yn) " answer
        if ((!OS_MAC)); then
            echo -e -n '\e[0m\n'
        else
            echo -e -n '\n'
        fi
    fi
    if [[ -z $answer && $default == "n" ]]; then
        return 1
    fi
    if [[ -z $answer || $answer =~ ^(y|Y)$ ]]; then
        return 0
    fi
    return 1;
}

zerr(){ LOG="$LOG$1\n"; }

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
    if ((PRINT_PERR)); then
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

download_script()
{
    local url=$1 out_path=$2
    rm $out_path 2> /dev/null
    for ((i=0; i<NETWORK_RETRY; i++)); do
        zerr "download_script $url retry: $i"
        if is_cmd_defined "curl"; then
            run_cmd "curl -fsSL $url -o $out_path"
        else
            run_cmd "wget -q ${WGET_FLAG} $url -O $out_path"
        fi
        ret=$?
        if ((!ret)); then
            return $ret
        fi
    done
    if ((ret)); then NETWORK_ERROR=1; fi
    return $ret
}

run_script()
{
    local name=$1 url=$2 lang=$3
    if [ -z "$lang" ]; then
        lang="sh"
    fi
    local script_path="/tmp/lpm_install_$name_$RID"
    download_script "$url" "$script_path"
    retry_cmd "cat $script_path | $lang"
    rm $script_path
}

check_linux_distr()
{
    local name=''
    if is_cmd_defined "lsb_release"; then
	name=$(lsb_release -s -d)
    elif [ -f "/etc/os-release" ]; then
	name=$(grep -m1 PRETTY_NAME /etc/os-release | \
            sed -e 's/PRETTY_NAME=//g' -e 's/"//g')
    elif [ -f "/etc/redhat-release" ]; then
	name=$(cat /etc/redhat-release)
    elif [ -f "/etc/debian_version" ]; then
	name="Debian $(cat /etc/debian_version)"
    fi
    escape_json $name
    zerr "linux distr: $name"
}

perr()
{
    local name=$1 note="$2" ts=$(date +"%s") ret=0
    escape_json "$note"
    zerr "PERR $name"
    local note=$RS url="${PERR_URL}/?id=lpm_sh_${name}"
    local data="{\"uuid\": \"$RID\", \"timestamp\": \"$ts\", \"ver\": \"$VERSION\", \"info\": {\"platform\": \"$OS\", \"c_ts\": \"$ts\", \"c_up_ts\": \"$TS_START\", \"note\": \"$note\", \"lum\": $LUM, \"root\":$IS_ROOT, \"os_release\":\"$OS_RELEASE\"}}"
    if ((PRINT_PERR)); then
        echo "perr $url $data"
    fi
    if ((NO_PERR)); then
        return 0
    fi
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

sys_install()
{
    local pkg=$1
    if [ -z "$pkg" ]; then
        return 1
    fi
    local pkg_mng="apt-get install -y"
    if ((OS_MAC)); then
        pkg_mng="brew install -y"
        retry_cmd "${pkg_mng} ${pkg}"
    else
        if is_cmd_defined "yum"; then
            pkg_mng="yum install -y"
        fi
        retry_sudo_cmd "${pkg_mng} ${pkg}"
    fi
}

install_shasum(){
    # hack for centos nave installation
    if ! is_cmd_defined "shasum"; then
        if ! is_cmd_defined "apt-get"; then
            sys_install "perl-Digest-SHA"
        else
            sys_install "libdigest-sha-perl"
        fi
    fi
}

sys_rm()
{
    local pkg=$1
    if [ -z "$pkg" ]; then
        return 1
    fi
    local pkg_mng="apt-get remove -y"
    if ((OS_MAC)); then
        pkg_mng="brew uninstall -y"
        run_cmd "${pkg_mng} ${pkg}"
    else
        if is_cmd_defined "yum"; then
            pkg_mng="yum remove -y"
        fi
        sudo_cmd "${pkg_mng} ${pkg}"
    fi
    return $?
}

check_wget()
{
    echo "checking wget..."
    if ! is_cmd_defined "wget"; then
        echo "will install wget"
        perr "check_no_wget"
        INSTALL_WGET=1
    else
        zerr "check_wget: $(wget --version | head -n 1 2>/dev/null)"
    fi
}

check_brew()
{
    echo "checking brew..."
    if ((OS_MAC)) && ! is_cmd_defined "brew"; then
        echo "will install brew"
        INSTALL_BREW=1
        perr "check_no_brew"
    fi
}

check_nvm()
{
    if is_fn_defined "nvm"; then
        return 0
    fi
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
    fi
    is_fn_defined "nvm"
    return $?
}

check_node()
{
    echo "checking nodejs..."
    if ((OS_MAC)); then
        REINSTALL_NODE_MAC=1
        perr "check_reinstall_node"
        return 0
    fi
    if is_cmd_defined "node"; then
        local node_ver=$(node -v)
        zerr "check_node: $node_ver"
        echo "node ${node_ver} is installed"
        if [ "$node_ver" != "v$NODE_VER" ]; then
            echo "required node version is $NODE_VER"
            perr "check_node_bad_version" "$node_ver"
            UPDATE_NODE=1
        fi
    else
        echo "node is not installed"
        INSTALL_NODE=1
        perr "check_no_node"
    fi
}

check_npm()
{
    echo "checking npm..."
    if ! is_cmd_defined 'npm'; then
        INSTALL_NPM=1
        perr "check_no_npm"
    else
        local npm_ver=$(npm -v)
        zerr "check_npm: $npm_ver"
        if [[ "$npm_ver" =~ ^([3,5,7-9]\.|[1-9][0-9]+\.) ]]; then
            UPDATE_NPM=1
            perr "check_npm_bad_version" "$npm_ver"
        fi
    fi
}

check_curl()
{
    echo "checking curl..."
    if ! is_cmd_defined "curl"; then
        echo "curl is not installed"
        perr 'check_no_curl'
        INSTALL_CURL=1
    else
        zerr "check_curl: $(curl --version | head -n 1 2>/dev/null)"
    fi
}

install_nave()
{
    if is_cmd_defined "nave"; then
        return 0
    fi
    echo "installing nave..."
    perr "install_nave"
    run_cmd "mkdir -p ~/.nave"
    local nave_path="$HOME/.nave/nave.sh"
    download_script "http://github.com/isaacs/nave/raw/master/nave.sh" \
        "$nave_path"
    run_cmd "chmod +x $nave_path"
    sudo_cmd "ln -s $nave_path /usr/local/bin/nave"
    sudo_cmd "mkdir -p /usr/local/{share/man,bin,lib/node,include/node}"
}

install_nave_node()
{
    install_nave
    echo "installing nave node $NODE_VER..."
    perr "install_nave_node"
    sudo_cmd "rm -rf ~/.nave/cache/$NODE_VER"
    sudo_cmd "rm -rf /root/.nave/cache/v$NODE_VER"
    retry_sudo_cmd "nave usemain $NODE_VER" 1
    if ! is_cmd_defined "node"; then
        perr "install_error_node"
        echo "could not install node"
        exit 1
    fi
}

install_nvm_node()
{
    echo "installing nvm node $NODE_VER..."
    perr "install_nvm_node"
    run_cmd "nvm install $NODE_VER"
    run_cmd "nvm alias default $NODE_VER"
}

install_node()
{
    install_nave_node
}

install_npm()
{
    echo "installing npm..."
    perr "install_npm"
    run_script "install_npm" "https://www.npmjs.com/install.sh"
    UPDATE_NPM=1
}

install_wget()
{
    echo "installing wget..."
    perr "install_wget"
    sys_install "wget"
}

install_curl()
{
    echo "installing curl..."
    perr "install_curl"
    sys_install "curl"
}

install_build_tools()
{
    if ((!OS_MAC)) && is_cmd_defined "apt-get"; then
        echo "installing build tools..."
        perr "install_build_tools"
        sys_install "build-essential"
        sys_install "base-devel"
    fi
}

install_brew()
{
    echo "installing brew..."
    perr "install_brew"
    run_script "install_brew" \
        "https://raw.githubusercontent.com/Homebrew/install/master/install" \
        "ruby"
}

update_npm()
{
    echo "updating npm to $NPM_VER"
    perr "update_npm" "$NPM_VER"
    retry_sudo_cmd "npm install -g npm@$NPM_VER > /dev/null"
}

reinstall_node_mac()
{
    update_npm
    NODE_VER='10.15.3'
    install_nave_node
}

check_env()
{
    echo "checking deps..."
    check_brew
    check_curl
    if ((INSTALL_CURL)); then
        check_wget
    fi
    # XXX romank: WIP
    #check_nvm
    check_node
}

deps_install()
{
    echo "installing deps..."
    if ((INSTALL_BREW)); then
        install_brew
    fi
    if ((INSTALL_WGET)); then
        install_wget
    fi
    if ((INSTALL_CURL)); then
        install_curl
    fi
    install_shasum
    if ((INSTALL_NODE||UPDATE_NODE)); then
        install_node
    fi
    if ((!OS_MAC)); then
        check_npm
    fi
    if ((INSTALL_NPM)); then
        install_npm
    fi
    if ((UPDATE_NPM)); then
        update_npm
    fi
    if ((REINSTALL_NODE_MAC)); then
        reinstall_node_mac
    fi
    install_build_tools
}

lpm_clean()
{
    echo "cleaning lpm related node packages and npm cache"
    local lib_path="$(npm prefix -g)/lib"
    local clean_cmd=(
        "npm uninstall -g luminati-proxy @luminati-io/luminati-proxy > /dev/null"
        "rm -rf $lib_path/node_modules/{@luminati-io,luminati-proxy}"
        "rm -rf $HOME/.npm"
        "mkdir -p $HOME/.npm/_cacache"
        "mkdir -p $HOME/.npm/_logs"
        "npm cache clean --force"
        "npm cache verify"
    )
    for cmd in "${clean_cmd[@]}"; do
        if ((USE_NVM)); then
            run_cmd "$cmd"
        else
            sudo_cmd "$cmd"
        fi
    done
    if ((!USE_NVM)); then
        sudo_cmd "rm -rf /root/.npm"
        echo "removing luminati links"
        sudo_cmd "rm -rf /usr/{local/bin,bin}/{luminati,luminati-proxy}"
    fi
}

lpm_install()
{
    perr "install" "lpm"
    echo "installing Luminati proxy manager..."
    local cmd="npm install -g --unsafe-perm --loglevel error @luminati-io/luminati-proxy"
    if ((USE_NVM)); then
        retry_cmd "$cmd" 0 1
    else
        retry_sudo_cmd "$cmd" 0 1
    fi
    if (($?)); then
        echo "Luminati failed to install from npm"
        perr "install_error_lpm"
        exit 1
    fi
    if ((!USE_NVM)); then
        if ((LUM)); then
            # fix luminati binary not found on luminati ubuntu
            echo "running nave relink"
            sudo_cmd "nave relink"
        elif ! [ -f "/usr/local/bin/luminati" ]; then
            sudo_cmd "ln -s $(npm bin -g)/luminati /usr/local/bin/luminati"
        fi
        if [ -f "/usr/local/bin/luminati" ]; then
            sudo_cmd "chmod a+x /usr/local/bin/luminati"
        fi
    fi
    perr "install_success_lpm"
}

check_install()
{
    echo "check install"
    if ! $(npm bin -g)/luminati -v > /dev/null; then
        echo "there was an error installing Luminati"
        perr "install_error_lpm_check"
        exit 1
    fi
    echo "Luminati installed successfully!"
    perr "install_success_lpm_check"
}

dev_setup()
{
    echo "removing LPM dependencies..."
    local lib_path="$(npm prefix -g)/lib"
    if prompt "Remove curl, wget, nodejs and npm" n; then
        sys_rm "curl wget nodejs npm"
    fi
    if prompt "Remove build essential" n; then
        sys_rm "build-essential"
        sys_rm "base-devel"
        sys_rm "perl-Digest-SHA"
    fi
    if ((OS_MAC)); then
        run_script "remove_brew" \
            "https://raw.githubusercontent.com/Homebrew/install/master/uninstall" \
            "ruby"
    fi
    rm -rf $HOME/.nvm
    if prompt "Remove node and all node modules?" n; then
        sudo_cmd "rm -rf $lib_path/node $lib_path/node_modules"
    fi
    if prompt "Remove npm and nave cache dirs" n; then
        sudo_cmd "rm -rf $lib_path/node $lib_path/node_modules ~/.npm ~/.nave"
    fi
    if prompt "Remove luminati, npm, nave, node links from /usr/local/bin"\
        n; then
        sudo_cmd "rm -rf /usr/local/bin/{luminati,liminati-proxy,npm,nave,node}"
    fi
    setup
}

setup()
{
    perr "start"
    echo "Luminati install script. Install id: $RID"
    check_env
    if ! prompt 'Install Luminati?' y; then
        perr "user_cancel"
        exit 0
    fi
    zerr "deps_install"
    deps_install
    lpm_clean
    lpm_install
    check_install
    perr "complete"
    echo "Luminati install script complete. Install id: $RID"
    echo "To run the process enter 'luminati'"
    echo "if this does not work try $(npm bin -g)/luminati"
}

on_exit()
{
    local exit_code=$?
    if ((!OS_MAC)); then
        echo -e -n '\e[0m\n'
    fi
    if ((!exit_code)); then
        perr "exit_ok" $exit_code
        perr "exit_ok_report" "$LOG"
    else
        perr "exit_error" $exit_code
        if ((NETWORK_ERROR)); then
            perr "exit_error_network"
        fi
        perr "exit_error_report" "$LOG"
    fi
    if [ -f $LOGFILE ]; then
        rm $LOGFILE
    fi
}

signal_handler()
{
    local signal=$1
    perr "$signal"
    exit 0
}

main()
{
    trap on_exit EXIT
    trap 'signal_handler "sigint"' INT
    check_sudo
    if ((OS_LINUX)); then
        check_linux_distr
    fi
    case "$ACTION" in
    setup)
        setup
        ;;
    clean)
        if prompt "Clean lpm related files and packages?" n; then
            lpm_clean
        fi
        ;;
    dev-setup)
        if prompt "Clean machine from lpm install and setup again?" n; then
           dev_setup
        fi
        ;;
    esac
    exit 0
}

while [ "${1:0:1}" = - ]; do
    case "$1" in
    --no-perr)
        NO_PERR=1
        ;;
    --print-perr)
        PRINT_PERR=1
        ;;
    -y)
        ASSUME_YES=1
        ;;
    *)
        usage
        ;;
    esac
    shift
done

if [[ -n "$1" && "$1" =~ (setup|dev-setup|clean) ]]; then
    ACTION="$1"
    shift
fi
if [ -n "$1" ]; then
    usage
fi

main
