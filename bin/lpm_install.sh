#!/usr/bin/env bash

arg=$1;

install_node=0;
install_npm=0;
install_curl=0;
install_git=0;
desired_node_ver='8.9.1';
desired_npm_ver='4.6.1';
downgrade_node=0;
update_node=0;
update_npm=0;


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
    if is_cmd_defined "brew"
        then
        pkg_mng="brew install -y"
    fi
    echo $pkg_mng;
    sudo_cmd "${pkg_mng} ${cmp}";
    return $?;
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
            update_node=1;
        fi
        if [[ "$node_ver" =~ ^(v[9]\.|v[1-9][0-9]+\.) ]]
            then
            echo "maximum required node version is 8";
            update_node=1;
        fi
    else
        echo 'node is not installed';
        install_node=1;
        update_npm=1;
    fi
    if [ "$install_node" == "0" ] && ! is_cmd_defined 'npm'
        then
        install_npm=1;
    fi
    if [ "$install_npm" == "0" ] && is_cmd_defined 'npm'
        then
        local npm_ver=$(npm -v);
        if [[ "$npm_ver" =~ ^([5-9]\.|[1-9][0-9]+\.) ]]
            then
            update_npm=1;
        fi
    fi

}

check_git()
{
    echo "checing git...";
    if ! is_cmd_defined "git"
        then
        echo 'git is not installed'
        install_git=1;
    fi
}

check_curl()
{
    echo "checking curl...";
    if ! is_cmd_defined "curl"
        then
        echo 'curl is not installed'
        install_curl=1
    fi
}

install_nave_fn()
{
    echo "installing nave";
    if ! is_cmd_defined "nave"
        then
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
    sudo_cmd "rm -rf ~/.nave/cache/$desired_node_ver"
    sudo_cmd "rm -rf /root/.nave/cache/v$desired_node_ver";
    sudo_cmd "nave usemain $desired_node_ver";
    if ! is_cmd_defined "node"
        then
        echo 'could not install node';
        exit 1;
    fi
}

install_npm_fn()
{
    echo "installing npm";
    curl https://www.npmjs.com/install.sh | sh;
    update_npm=1;
}

install_curl_fn()
{
    echo "installing curl";
    sys_install "curl";
}

install_git_fn()
{
    echo "installing git";
    sys_install "git";
}

update_npm_fn()
{
 echo "updating npm to $desired_npm_ver";
 sudo_cmd "npm install -g npm@$desired_npm_ver";
}

check_env()
{
    echo "checking deps...";
    check_curl;
    check_git;
    check_node;
}

deps_install()
{
    echo 'installing deps';
    if [ "$install_curl" == "1" ]
        then
        install_curl_fn;
    fi
    if [ "$install_git" == "1" ]
        then
        install_git_fn;
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

    local lib_path=$(npm list -g | head -1);
    local home=$HOME;
    sudo_cmd "rm -rf $lib_path/node_modules/@luminati-io";
    sudo_cmd "rm -rf $lib_path/node_modules/sqlite3";
    sudo_cmd "rm -rf $lib_path/node_modules/luminati-proxy";
    sudo_cmd "rm -rf $home/.npm /root/.npm";
    mkdir -p $HOME/.npm/_cacache
    mkdir -p $HOME/.npm/_logs
    git config --global url."git+https://github.com/".insteadOf git@github.com:
    git config --global url."git+https://".insteadOf git://
}

lpm_install()
{
    echo "installing Luminati proxy manager";
    lpm_clean;
    sudo_cmd "npm install -g --unsafe-perm @luminati-io/luminati-proxy";
    if [[ $? != 0 ]]; then exit $?; fi
    }

    check_install()
    {
     echo 'check install';
     if ! luminati -v > /dev/null
         then
         echo 'there was an error installing Luminait';
         exit 1;
     fi
     echo "Luminati installed successfully";
}

clean()
{
    sudo_cmd "apt-get remove -y curl nodejs npm git";
    local lib_path=$(npm list -g | head -1);
    sudo_cmd "rm -rf $lib_path/node $lib_path/node_modules ~/.npm ~/.nave";
    sudo_cmd "rm -rf /usr/local/bin/{luminati,liminati-proxy,npm,nave,node}";
}

main()
{
    check_env;
    deps_install;
    lpm_install;
    check_install;
}

if [ "$arg" == "clean" ]; then clean; exit 0; fi;
main;
