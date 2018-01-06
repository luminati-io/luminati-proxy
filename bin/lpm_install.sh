#!/usr/bin/env bash

arg=$1;

run_id=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
start_time=$(date +"%s");

PERR_URL="https://perr.luminati.io/client_cgi/perr";

install_node=0;
install_wget=0;
install_npm=0;
install_curl=0;
install_brew=0;
desired_node_ver='8.9.1';
desired_npm_ver='4.6.1';
downgrade_node=0;
update_node=0;
update_npm=0;

uname_out="$(uname -s)"
os_name=""

case "${uname_out}" in
    Linux*)     os_name=Linux;;
    Darwin*)    os_name=Mac;;
    CYGWIN*)    os_name=Cygwin;;
    MINGW*)     os_name=MinGw;;
    *)          os_name="UNKNOWN:${unameOut}"
esac

is_cmd_defined()
{
    local cmd=$1;
    type -P "$cmd" > /dev/null;
    return $?;
}

sudo_cmd()
{
    local sdo="sudo -i";
    local cmd="$1";
    if is_cmd_defined "rt"
        then
        sdo="rt";
    fi;
    eval "$sdo $cmd";
    return $?;
}

perr()
{
    local name=$1;
    local note=$2;
    local ts=$(date +"%s");
    local url="${PERR_URL}/?id=lpm_sh_${name}";
    local data="{\"uuid\": \"$run_id\", \"timestamp\": \"$ts\", \"info\": {\"platform\": \"$os_name\", \"c_ts\": \"$ts\", \"c_up_ts\": \"$start_time\", \"note\": \"$note\"}}";
    if is_cmd_defined "curl"; then
        curl -X POST "$url" --data "$data" -H "Content-Type: application/json";
    elif is_cmd_defined "wget"; then
        wget -S --header "Content-Type: application/json" \
             -O /dev/null -o /dev/null --post-data="$data" --quiet $url;
    else
        echo "perr $url $data";
    fi
}

sys_install()
{
    local cmp=$1;
    if [ -z "$cmp" ];
        then
        return 1;
    fi;
    local pkg_mng="apt-get install -y"
    if is_cmd_defined "yum"
        then
        pkg_mng="yum install -y"
    fi
    if [ "$os_name" == "Mac" ]
        then
        pkg_mng="brew install -y"
        eval "${pkg_mng} ${cmp}";
        return $?;
    fi
    if [ $os_name != "Mac" ]
        then
        sudo_cmd "${pkg_mng} ${cmp}";
    fi
    return $?;
}

sys_rm()
{
    local cmp=$1;
    if [ -z "$cmp" ];
        then
        return 1;
    fi;
    local pkg_mng="apt-get remove -y"
    if is_cmd_defined "yum"
        then
        pkg_mng="yum remove -y"
    fi
    if [ "$os_name" == "Mac" ]
        then
        pkg_mng="brew uninstall -y"
        eval "${pkg_mng} ${cmp}";
        return $?;
    fi
    if [ $os_name != "Mac" ]
        then
        sudo_cmd "${pkg_mng} ${cmp}";
    fi
    return $?;
}

check_wget()
{
    echo "checking wget...";
    if ! is_cmd_defined "wget"
        then
        echo "will install wget"
        perr "check_no_wget"
        install_wget=1;
    fi
}

check_brew()
{
    echo "checking brew...";
    if [ "$os_name" == "Mac" ] && ! is_cmd_defined "brew"
        then
        echo "will install brew"
        install_brew=1;
        perr "check_no_brew"
    fi
}

check_node()
{
    echo "checking nodejs...";
    if is_cmd_defined "node"
        then
        local node_ver=$(node -v);
        echo "node ${node_ver} is installed";
        if ! [[ "$node_ver" =~ ^(v[6-9]\.|v[1-9][0-9]+\.) ]]
            then
            echo "minimum required node version is 6";
            perr "check_node_bad_version" "$node_ver";
            update_node=1;
        fi
        if [[ "$node_ver" =~ ^(v[9]\.|v[1-9][0-9]+\.) ]]
            then
            echo "maximum required node version is 8";
            perr "check_node_bad_version" "$node_ver";
            update_node=1;
        fi
    else
        echo 'node is not installed';
        install_node=1;
        update_npm=1;
        perr "check_no_node"
    fi
    if [ "$install_node" == "0" ] && ! is_cmd_defined 'npm'
        then
        install_npm=1;
        perr "check_no_npm"
    fi
    if [ "$install_npm" == "0" ] && is_cmd_defined 'npm'
        then
        local npm_ver=$(npm -v);
        if [[ "$npm_ver" =~ ^([3,5-9]\.|[1-9][0-9]+\.) ]]
            then
            update_npm=1;
            perr "check_npm_bad_version" "$npm_ver"
        fi
    fi

}

check_curl()
{
    echo "checking curl...";
    if ! is_cmd_defined "curl"
        then
        echo 'curl is not installed'
        perr 'check_no_curl';
        install_curl=1
    fi
}

install_nave_fn()
{
    if ! is_cmd_defined "nave"
        then
        echo "installing nave";
        perr "install_nave";
        mkdir -p ~/.nave
        cd ~/.nave;
        wget http://github.com/isaacs/nave/raw/master/nave.sh
        chmod +x ./nave.sh
        sudo_cmd "ln -s $PWD/nave.sh /usr/local/bin/nave"
        sudo_cmd "mkdir -p /usr/local/{share/man,bin,lib/node,include/node}"
        cd -;
    fi
}

install_node_fn()
{
    install_nave_fn;
    echo "installing node $desired_node_ver";
    perr "install_node";
    sudo_cmd "rm -rf ~/.nave/cache/$desired_node_ver"
    sudo_cmd "rm -rf /root/.nave/cache/v$desired_node_ver";
    sudo_cmd "nave usemain $desired_node_ver";
    if ! is_cmd_defined "node"
        then
        perr "install_error_node";
        echo 'could not install node';
        exit 1;
    fi
}

install_npm_fn()
{
    echo "installing npm";
    perr "install_npm";
    curl https://www.npmjs.com/install.sh | sh;
    update_npm=1;
}

install_wget_fn()
{
    echo "installing wget";
    perr "install_wget";
    sys_install "wget";
}

install_curl_fn()
{
    echo "installing curl";
    perr "install_curl";
    sys_install "curl";
}

install_brew_fn()
{
    echo "installing brew"
    perr "install_brew";
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)";
}

update_npm_fn()
{
    echo "updating npm to $desired_npm_ver";
    perr "install_npm" "$desired_npm_ver";
    sudo_cmd "npm install -g npm@$desired_npm_ver";
}

check_env()
{
    echo "checking deps...";
    check_brew;
    check_curl;
    check_wget;
    check_node;
}

deps_install()
{
    echo 'installing deps';
    if [ "$install_brew" == "1" ]
        then
        install_brew_fn;
    fi
    if [ "$install_wget" == "1" ]
        then
        install_wget_fn;
    fi
    if [ "$install_curl" == "1" ]
        then
        install_curl_fn;
    fi
    if [ "$install_node" == "1" ] || [ "$update_node" == "1" ]
        then
        install_node_fn;
    fi
    if [ "$install_npm" == "1" ]
        then
        install_npm_fn;
    fi
    if [ "$update_npm" == "1" ]
        then
        update_npm_fn;
    fi;
}

lpm_clean()
{

    sudo_cmd "npm uninstall -g luminati-proxy @luminati-io/luminati-proxy";
    local lib_path=$(npm list -g | head -1);
    local home=$HOME;
    sudo_cmd "rm -rf $lib_path/node_modules/{@luminati-io,sqlite3,luminati-proxy}";
    sudo_cmd "rm -rf $home/.npm /root/.npm";
    sudo_cmd "rm -rf /usr/{local/bin,bin}/{luminati,luminati-proxy}";
    mkdir -p $HOME/.npm/_cacache
    mkdir -p $HOME/.npm/_logs
}

lpm_install()
{
    echo "installing Luminati proxy manager";
    perr "install" "lpm";
    lpm_clean;
    sudo_cmd "npm install -g --unsafe-perm @luminati-io/luminati-proxy";
    if [[ $? != 0 ]]; then
        perr "install_error_lpm";
        exit $?;
    else
        perr "install_success_lpm";
    fi
}

check_install()
{
    echo 'check install';
    if ! luminati -v > /dev/null
    then
        echo 'there was an error installing Luminait';
        perr "install_error_lpm_check";
        exit 1;
    fi
    echo "Luminati installed successfully";
    perr "install_success_lpm_check";
}

clean()
{
    local lib_path=$(npm list -g | head -1);
    sys_rm "curl wget nodejs npm";
    sudo_cmd "rm -rf $lib_path/node $lib_path/node_modules ~/.npm ~/.nave";
    sudo_cmd "rm -rf /usr/local/bin/{luminati,liminati-proxy,npm,nave,node}";
}

main()
{
    perr "start"
    echo "Luminati install script. Install id: $run_id";
    check_env;
    deps_install;
    lpm_install;
    check_install;
    perr "complete"
    echo "Luminati install script complete. Install id: $run_id";
}

if [ "$arg" == "clean" ]; then clean; exit 0; fi;

main;
