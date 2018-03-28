#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
PERR_URL="https://perr.luminati.io/client_cgi/perr"
ACTION="setup"
IS_ROOT=0
if [ $(id -u) = 0 ]; then
    IS_ROOT=1
fi
LUM=0
VERSION="1.89.371"
if [ -f  "/usr/local/hola/zon_config.sh" ]; then
    LUM=1
fi
RID=$(cat /dev/urandom | LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 |\
    head -n 1)
TS_START=$(date +"%s")
INSTALL_NODE=0
INSTALL_WGET=0
INSTALL_NPM=0
INSTALL_CURL=0
INSTALL_BREW=0
NODE_VER='9.4.0'
NPM_VER='4.6.1'
UPDATE_NODE=0
UPDATE_NPM=0
OS=""
OS_MAC=0
OS_LINUX=0
OS_RELEASE=""
ASSUME_YES=0
case "$(uname -s)" in
Linux*)
    OS="Linux"
    OS_LINUX=1
    ;;
Darwin*)
    OS="Mac"
    OS_MAC=1
    ;;
CYGWIN*)
    OS="Cygwin"
    ;;
MINGW*)
    OS="MinGw"
    ;;
*)
    OS="$OS"
    ;;
esac
if ((OS_LINUX)); then
    OS_RELEASE=$(lsb_release -a)
fi

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
    echo "  dev-clean     - attempt to clean any traces of lpm and it's"
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

is_cmd_defined()
{
    local cmd=$1
    type -P "$cmd" > /dev/null
    return $?
}

sudo_cmd()
{
    local sdo="sudo -i"
    local cmd="$1"
    if ((LUM)); then
        sdo="rt"
    fi
    if ((IS_ROOT)); then
        sdo=""
    fi
    eval "$sdo $cmd"
    return $?
}

perr()
{
    local name=$1
    local note=$2
    local ts=$(date +"%s")
    local url="${PERR_URL}/?id=lpm_sh_${name}"
    local data="{\"uuid\": \"$RID\", \"timestamp\": \"$ts\", \"ver\": \"$VERSION\", \"info\": {\"platform\": \"$OS\", \"c_ts\": \"$ts\", \"c_up_ts\": \"$TS_START\", \"note\": \"$note\", \"lum\": $LUM, \"root\":$IS_ROOT, \"os_release\":\"$OS_RELEASE\"}}"
    if ((PRINT_PERR)); then
        echo "perr $url $data"
    fi
    if ((NO_PERR)); then
        return 0
    fi
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
        eval "${pkg_mng} ${pkg}"
    else
        if is_cmd_defined "yum"; then
            pkg_mng="yum install -y"
        fi
        sudo_cmd "${pkg_mng} ${pkg}"
    fi
    return $?
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
        eval "${pkg_mng} ${pkg}"
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

check_node()
{
    echo "checking nodejs..."
    if is_cmd_defined "node"; then
        local node_ver=$(node -v)
        echo "node ${node_ver} is installed"
        if ! [[ "$node_ver" =~ ^(v[6-9]\.|v[1-9][0-9]+\.) ]]; then
            echo "minimum required node version is 6"
            perr "check_node_bad_version" "$node_ver"
            UPDATE_NODE=1
        fi
        if [[ "$node_ver" =~ ^(v[1-9][0-9]+\.) ]]; then
            echo "maximum required node version is 9"
            perr "check_node_bad_version" "$node_ver"
            UPDATE_NODE=1
        fi
    else
        echo 'node is not installed'
        INSTALL_NODE=1
        UPDATE_NPM=1
        perr "check_no_node"
    fi
    if ((INSTALL_NODE)) && ! is_cmd_defined 'npm'; then
        INSTALL_NPM=1
        perr "check_no_npm"
    fi
    if ((!INSTALL_NPM)) && is_cmd_defined 'npm'; then
        local npm_ver=$(npm -v)
        if [[ "$npm_ver" =~ ^([3,5-9]\.|[1-9][0-9]+\.) ]]; then
            UPDATE_NPM=1
            perr "check_npm_bad_version" "$npm_ver"
        fi
    fi
}

check_curl()
{
    echo "checking curl..."
    if ! is_cmd_defined "curl"; then
        echo 'curl is not installed'
        perr 'check_no_curl'
        INSTALL_CURL=1
    fi
}

install_nave()
{
    local gzip_flag=''
    if ! is_cmd_defined "nave"; then
        echo "installing nave"
        perr "install_nave"
        mkdir -p ~/.nave
        cd ~/.nave
        if ((OS_MAC)); then
            gzip_flag = '--compression=none'
        fi
        wget ${gzip_flag} http://github.com/isaacs/nave/raw/master/nave.sh
        chmod +x ./nave.sh
        sudo_cmd "ln -s $PWD/nave.sh /usr/local/bin/nave"
        sudo_cmd "mkdir -p /usr/local/{share/man,bin,lib/node,include/node}"
        cd -
    fi
}

install_node()
{
    install_nave
    echo "installing node $NODE_VER"
    perr "install_node"
    sudo_cmd "rm -rf ~/.nave/cache/$NODE_VER"
    sudo_cmd "rm -rf /root/.nave/cache/v$NODE_VER"
    sudo_cmd "SHELL=/bin/bash nave usemain $NODE_VER"
    if ! is_cmd_defined "node"; then
        perr "install_error_node"
        echo 'could not install node'
        exit 1
    fi
}

install_npm()
{
    echo "installing npm"
    perr "install_npm"
    curl https://www.npmjs.com/install.sh | sh
    UPDATE_NPM=1
}

install_wget()
{
    echo "installing wget"
    perr "install_wget"
    sys_install "wget"
}

install_curl()
{
    echo "installing curl"
    perr "install_curl"
    sys_install "curl"
}

install_brew()
{
    echo "installing brew"
    perr "install_brew"
    /usr/bin/ruby -e \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
}

update_npm()
{
    echo "updating npm to $NPM_VER"
    perr "install_npm" "$NPM_VER"
    sudo_cmd "npm install -g npm@$NPM_VER > /dev/null"
}

check_env()
{
    echo "checking deps..."
    check_brew
    check_curl
    check_wget
    check_node
}

deps_install()
{
    echo 'installing deps'
    if ((INSTALL_BREW)); then
        install_brew
    fi
    if ((INSTALL_WGET)); then
        install_wget
    fi
    if ((INSTALL_CURL)); then
        install_curl
    fi
    if ((INSTALL_NODE||UPDATE_NODE)); then
        install_node
    fi
    if ((INSTALL_NPM)); then
        install_npm
    fi
    if ((UPDATE_NPM)); then
        update_npm
    fi
}

lpm_clean()
{
    echo "cleaning lpm related node packages"
    sudo_cmd "npm uninstall -g luminati-proxy @luminati-io/luminati-proxy > /dev/null"
    local lib_path="$(npm prefix -g)/lib"
    local home=$HOME
    sudo_cmd \
        "rm -rf $lib_path/node_modules/{@luminati-io,sqlite3,luminati-proxy}"
    echo "cleaning node cache"
    sudo_cmd "rm -rf $home/.npm /root/.npm"
    echo "removing luminati links"
    sudo_cmd "rm -rf /usr/{local/bin,bin}/{luminati,luminati-proxy}"
    mkdir -p $HOME/.npm/_cacache
    mkdir -p $HOME/.npm/_logs
}

lpm_install()
{
    echo "installing Luminati proxy manager"
    perr "install" "lpm"
    lpm_clean
    sudo_cmd "npm install -g --unsafe-perm @luminati-io/luminati-proxy > /dev/null"
    if [[ ! $? ]]; then
        echo "Luminati failed to install from npm"
        perr "install_error_lpm"
        exit $?
    else
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
        perr "install_success_lpm"
    fi
}

check_install()
{
    echo 'check install'
    if ! $(npm bin -g)/luminati -v > /dev/null; then
        echo 'there was an error installing Luminati'
        perr "install_error_lpm_check"
        exit 1
    fi
    echo "Luminati installed successfully!"
    perr "install_success_lpm_check"
}

dev_clean()
{
    local lib_path="$(npm prefix -g)/lib"
    if prompt "Remove curl, wget, nodejs and npm" n; then
        sys_rm "curl wget nodejs npm"
    fi
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
    deps_install
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
    else
        perr "exit_error" $exit_code
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
    case "$ACTION" in
    setup)
        setup
        ;;
    clean)
        if prompt "Clean lpm related files and packages?" n; then
            lpm_clean
        fi
        ;;
    dev-clean)
        if prompt "Clean machine from lpm install?" n; then
            echo "dev_clean"
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

if [[ -n "$1" && "$1" =~ (setup|dev-clean|clean) ]]; then
    ACTION="$1"
    shift
fi
if [ -n "$1" ]; then
    usage
fi

main
