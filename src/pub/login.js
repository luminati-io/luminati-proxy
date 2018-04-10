// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import classnames from 'classnames';
import {Typeahead} from 'react-bootstrap-typeahead';
import $ from 'jquery';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import {Loader} from './common.js';

class Login extends Pure_component {
    constructor(props){
        super(props);
        this.state = {password: '', username: '', loading: false};
    }
    componentDidMount(){
        this.setdb_on('head.settings', settings=>this.setState({settings}));
        this.setdb_on('head.ver_node', ver_node=>this.setState({ver_node}));
        const url_o = zurl.parse(document.location.href);
        const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
        if (qs_o.t)
        {
            this.token = qs_o.t.replace(/\s+/g, '+');
            this.save_user();
        }
    }
    update_password({target: {value}}){ this.setState({password: value}); }
    update_username({target: {value}}){ this.setState({username: value}); }
    select_customer(customer){ this.setState({customer}); }
    save_user(){
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
                _this.check_reload();
            _this.setState({loading: false});
        });
    }
    check_reload(){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', _this.check_reload);
            yield ajax({url: '/overview'});
            window.location = '/overview';
        });
    }
    render(){
        return (
            <div className="lpm lum_login">
              <Messages error_message={this.state.error_message}
                settings={this.state.settings}
                ver_node={this.state.ver_node}/>
              <Loader show={this.state.loading}/>
              <Header/>
              <Form
                save_user={this.save_user.bind(this)}
                user_customers={this.state.user_customers}
                password={this.state.password}
                username={this.state.username}
                update_password={this.update_password.bind(this)}
                update_username={this.update_username.bind(this)}
                select_customer={this.select_customer.bind(this)}/>
            </div>
        );
    }
}

const parse_arguments = (settings={argv: ''})=>
    settings.argv.replace(/(--password )(.+?)( --|$)/, '$1|||$2|||$3')
    .split('|||');

const Messages = ({error_message, settings, ver_node})=>(
    <div>
      <If when={settings&&settings.argv}>
        <div className="warning">
          <div className="warning_icon"/>
          The application is running with the following arguments:
          {parse_arguments(settings).map(a=><strong key={a}>{a}</strong>)}
        </div>
      </If>
      <If when={error_message}>
        <div className="warning error settings-alert">
          <div dangerouslySetInnerHTML={{__html: error_message}}/>
        </div>
      </If>
      <Node_message ver_node={ver_node}/>
    </div>
);

const Node_message = ({ver_node})=>{
    if (!ver_node || ver_node.is_electron || ver_node.satisfied)
        return null;
    return (
        <div className="warning settings-alert">
          <div className="warning_icon"/>
          <div>
            <div>
              The recommended version of node.js is
              <strong> {ver_node.recommended}</strong>. You are using version
              <strong> {ver_node.current&&ver_node.current.raw}</strong>.
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
        </div>
    );
};

const Header = ()=>(
    <div className="row login_header">
      <h3>Login with your Luminati account</h3>
    </div>
);

const Form = ({user_customers, save_user, update_password, update_username,
    select_customer, password, username})=>
{
    const google_login_url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=943425271003-8ibddns3o1ftp59t2su8c3psocph9v1d.apps.googleusercontent.com&response_type=code&redirect_uri=https%3A%2F%2Fluminati.io%2Fcp%2Flum_local_google&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&prompt=select_account";
    const google_click = e=>{
        const google = $(e);
        const l = window.location;
        const href = google_login_url+'&state='+encodeURIComponent(
            l.protocol+'//'+l.hostname+':'+(l.port||80)+'?api_version=3');
        window.location = href;
    };
    if (user_customers)
        return (
            <Customers_form
              user_customers={user_customers}
              save_user={save_user}
              select_customer={select_customer}/>
        );
    else
        return (
            <First_form
              password={password}
              username={username}
              google_click={google_click}
              save_user={save_user}
              update_password={update_password}
              update_username={update_username}/>
        );
};

const Typeahead_wrapper = ({data, disabled, on_change, val})=>(
    <Typeahead options={data} maxResults={10}
      minLength={0} disabled={disabled} selectHintOnEnter
      filterBy={(option, text)=>option.indexOf(text)==0}
      onChange={on_change} selected={val}/>
);

class Customers_form extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    on_change(e){
        this.setState({cur_customer: e});
        this.props.select_customer(e&&e[0]);
    }
    render(){
        return (
            <div className="row customers_form">
              <div className="warning choose_customer">
                Please choose a customer.</div>
              <div className="form-group">
                <label htmlFor="user_customer">Customer</label>
                <Typeahead_wrapper data={this.props.user_customers}
                  val={this.state.cur_customer}
                  on_change={this.on_change.bind(this)}/>
              </div>
              <button
                onClick={this.props.save_user}
                className="btn btn_lpm btn_login"
                disabled={this.props.saving_user}>
                {this.props.saving_user ? 'Logging in...' : 'Log in'}
              </button>
            </div>
        );
    }
}

class First_form extends Pure_component {
    render(){
        const {google_click, saving_user, password, username} = this.props;
        return (
            <div className="login_form">
              <div>
                <div className="row">
                  <div className="col col_google col-sm-6">
                    <div className="btn_google_wrapper">
                      <a className="btn btn_lpm btn_google"
                        onClick={google_click}>
                        <div className="img"/>
                        Log in with Google
                      </a>
                    </div>
                  </div>
                  <div className="col col_pass col-sm-6">
                    <div className="form-group">
                      <label htmlFor="username">Email</label>
                      <input type="email" name="username"
                        onChange={this.props.update_username}
                        value={username}/>
                    </div>
                    <div className="form-group">
                      <label htmlFor="user_password">Password</label>
                      <input type="password" name="password"
                        onChange={this.props.update_password}
                        value={password}/>
                    </div>
                    <button type="submit" className="btn btn_lpm btn_login"
                      onClick={this.props.save_user}>
                      {saving_user ? 'Logging in...' : 'Log in'}
                    </button>
                  </div>
                  <div className="or_circle">Or</div>
                </div>
                <div className="row">
                  <div className="signup">
                    Don't have a Luminati account?
                    <a href="https://luminati.io/?need_signup=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link">
                      Sign up
                    </a>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

export default Login;
