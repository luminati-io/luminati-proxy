// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import Pure_component from '/www/util/pub/pure_component.js';
import {Typeahead} from 'react-bootstrap-typeahead';
import ajax from '../../util/ajax.js';
import etask from '../../util/etask.js';
import setdb from '../../util/setdb.js';
import zurl from '../../util/url.js';
import {Loader, Logo} from './common.js';
import {T} from './common/i18n.js';

const Login = withRouter(class Login extends Pure_component {
    state = {password: '', username: '', loading: false};
    componentDidMount(){
        this.setdb_on('head.argv', argv=>{
            if (argv)
                this.setState({argv});
        });
        this.setdb_on('head.ver_node', ver_node=>this.setState({ver_node}));
        const url_o = zurl.parse(document.location.href);
        const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
        if (qs_o.t)
        {
            this.token = qs_o.t.replace(/\s+/g, '+');
            this.save_user();
        }
    }
    update_password = ({target: {value}})=>this.setState({password: value});
    update_username = ({target: {value}})=>this.setState({username: value});
    select_customer = customer=>this.setState({customer});
    save_user = ()=>{
        const creds = {};
        if (this.token)
            creds.token = this.token;
        else
        {
            creds.username = this.state.username;
            creds.password = this.state.password;
        }
        if (this.state.customer)
            creds.customer = this.state.customer;
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                const update = {loading: false};
                if (e.message=='Unauthorized')
                    update.error_message = 'Unauthorized';
                else
                    update.error_message = 'Something went wrong';
                _this.setState(update);
            });
            this.on('finally', ()=>_this.setState({loading: false}));
            _this.setState({loading: true});
            const res = yield ajax.json({url: '/api/creds_user',
                method: 'POST', data: creds, timeout: 60000});
            if (res.error)
            {
                _this.setState({error_message:
                    res.error.message||'Something went wrong'});
            }
            else if (res.customers)
            {
                _this.setState({
                    user_customers: res.customers,
                    error_message: '',
                    user_data: {customer: res.customers[0]},
                });
            }
            else
                _this.get_in();
        });
    };
    get_in = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                _this.setState({error_message: 'Cannot log in: '+e.message});
            });
            const ets = [];
            ets.push(etask(function*_get_settings(){
                const settings = yield ajax.json({url: '/api/settings'});
                window.ga('set', 'dimension1', settings.customer);
                setdb.set('head.settings', settings);
            }));
            ets.push(etask(function*_get_consts(){
                const consts = yield ajax.json({url: '/api/consts'});
                setdb.set('head.consts', consts);
            }));
            const curr_locations = setdb.get('head.locations');
            if (!curr_locations || !curr_locations.shared_countries)
            {
                ets.push(etask(function*_get_locations(){
                    const locations = yield ajax.json(
                        {url: '/api/all_locations'});
                    locations.countries_by_code = locations.countries.reduce(
                    (acc, e)=>({...acc, [e.country_id]: e.country_name}), {});
                    setdb.set('head.locations', locations);
                }));
            }
            ets.push(etask(function*_get_zones(){
                const zones = yield ajax.json({url: '/api/zones'});
                setdb.set('head.zones', zones);
            }));
            ets.push(etask(function*_get_proxies_running(){
                const proxies = yield ajax.json({url: '/api/proxies_running'});
                setdb.set('head.proxies_running', proxies);
            }));
            yield etask.all(ets);
            _this.props.history.push('/overview');
        });
    };
    render(){
        return <div className="lum_login">
              <Logo/>
              <Messages error_message={this.state.error_message}
                argv={this.state.argv}
                ver_node={this.state.ver_node}/>
              <Loader show={this.state.loading}/>
              <Header/>
              <Form save_user={this.save_user}
                user_customers={this.state.user_customers}
                password={this.state.password}
                username={this.state.username}
                update_password={this.update_password}
                update_username={this.update_username}
                select_customer={this.select_customer}/>
            </div>;
    }
});

const parse_arguments = argv=>
    argv.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3').split('|||');

const Messages = ({error_message, argv, ver_node})=>
    <div>
      {argv &&
        <div className="warning">
          <div className="warning_icon"/>
          The application is running with the following arguments:
          {parse_arguments(argv).map(a=><strong key={a}>{a}</strong>)}
        </div>
      }
      {error_message &&
        <div className="warning error settings-alert">
          <div dangerouslySetInnerHTML={{__html: error_message}}/>
        </div>
      }
      <Node_message ver_node={ver_node}/>
    </div>;

const Node_message = ({ver_node})=>{
    if (!ver_node || ver_node.is_electron || ver_node.satisfied)
        return null;
    return <div className="warning settings-alert">
          <div className="warning_icon"/>
          <div>
            <div>
              <span>The recommended version of node.js is </span>
              <strong>{ver_node.recommended}</strong>.
              <span>You are using version </span>
              <strong>{ver_node.current && ver_node.current.raw}</strong>.
            </div>
            <div>
              Please upgrade your node using nvm, nave or visit
              <a href="https://nodejs.org">node.js</a>and download a newer
              version.
            </div>
            <div>
              After node upgrade you should uninstall and then reinstall this
              tool using:
            </div>
            <pre className="top-margin">
              npm uninstall -g @luminati-io/luminati-proxy</pre>
            <pre className="top-margin">
              npm install -g @luminati-io/luminati-proxy</pre>
          </div>
        </div>;
};

const Header = ()=>
    <div className="login_header">
      <h3><T>Login with your Luminati account</T></h3>
    </div>;

const Form = props=>{
    const google_login_url = 'https://accounts.google.com/o/oauth2/v2/auth?'
    +'client_id=943425271003-8ibddns3o1ftp59t2su8c3psocph9v1d.apps.'
    +'googleusercontent.com&response_type=code&redirect_uri='
    +'https%3A%2F%2Fluminati.io%2Fcp%2Flum_local_google&scope=https%3A%2F%2F'
    +'www.googleapis.com%2Fauth%2Fuserinfo.email&prompt=select_account';
    const google_click = e=>{
        const l = window.location;
        const href = google_login_url+'&state='+encodeURIComponent(
            l.protocol+'//'+l.hostname+':'+(l.port||80)+'?api_version=3');
        window.location = href;
    };
    if (props.user_customers)
    {
        return <Customers_form user_customers={props.user_customers}
              save_user={props.save_user}
              select_customer={props.select_customer}/>;
    }
    return <First_form password={props.password}
          username={props.username}
          google_click={google_click}
          save_user={props.save_user}
          update_password={props.update_password}
          update_username={props.update_username}/>;
};

const filter_by = (option, props)=>{
    return option.indexOf(props.text)==0;
};
const Typeahead_wrapper = ({data, disabled, on_change, val})=>
    <Typeahead options={data} maxResults={10}
      minLength={0} disabled={disabled} selectHintOnEnter
      filterBy={filter_by} onChange={on_change} selected={val}/>;

class Customers_form extends Pure_component {
    state = {};
    on_change = e=>{
        this.setState({cur_customer: e});
        this.props.select_customer(e&&e[0]);
    };
    render(){
        return <T>{t=><div className="row customers_form">
              <div className="warning choose_customer">
                {t('Please choose a customer.')}</div>
              <div className="form-group">
                <label htmlFor="user_customer">{t('Customer')}</label>
                <Typeahead_wrapper data={this.props.user_customers}
                  val={this.state.cur_customer} on_change={this.on_change}/>
              </div>
              <button
                onClick={this.props.save_user}
                className="btn btn_lpm btn_login"
                disabled={this.props.saving_user}>
                {this.props.saving_user ? t('Logging in...') : t('Log in')}
              </button>
            </div>}</T>;
    }
}

class First_form extends Pure_component {
    on_key_up = e=>{
        if (e.keyCode==13)
            this.props.save_user();
    };
    render(){
        const {google_click, saving_user, password, username} = this.props;
        return <div className="login_form">
              <T>{t=><div>
                <div className="row">
                  <div className="col col_google col-sm-6">
                    <div className="btn_google_wrapper">
                      <a className="btn btn_lpm btn_google"
                        onClick={google_click}>
                        <div className="img"/>
                        {t('Log in with Google')}
                      </a>
                    </div>
                  </div>
                  <div className="col col_pass col-sm-6">
                    <div className="form-group">
                      <label htmlFor="username">{t('Email')}</label>
                      <input type="email"
                        name="username"
                        onChange={this.props.update_username}
                        onKeyUp={this.on_key_up}
                        value={username}/>
                    </div>
                    <div className="form-group">
                      <label htmlFor="user_password">{t('Password')}</label>
                      <input type="password"
                        name="password"
                        onChange={this.props.update_password}
                        onKeyUp={this.on_key_up}
                        value={password}/>
                    </div>
                    <button type="submit"
                      className="btn btn_lpm btn_login"
                      onClick={this.props.save_user}>
                      {saving_user ? t('Logging in...') : t('Log in')}
                    </button>
                  </div>
                  <div className="or_circle">Or</div>
                </div>
                <div className="row">
                  <div className="signup">
                    {t('Don\'t have a Luminati account?')}
                    <a href="https://luminati.io/?need_signup=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link">
                      {t('Sign up')}
                    </a>
                  </div>
                </div>
              </div>
            }</T></div>;
    }
}

export default Login;
