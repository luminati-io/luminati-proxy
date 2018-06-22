// LICENSE_CODE ZON
'use strict'; /*jslint node:true, react:true*/
var define;
var is_node = typeof module=='object' && module.exports;
if (is_node)
    define = require('../../../util/require_node.js').define(module, '..');
else
    define = self.define;

define(['virt_jquery_all', 'lodash', 'react', 'react-dom', 'react-router-dom',
    '/util/url.js', '/util/ajax.js', '/www/util/pub/pure_component.js',
    'react-bootstrap', '/util/setdb.js', '/util/etask.js', '/util/match.js',
    '/util/country.js', '/util/date.js', '/www/locale/pub/i18n_react.js'],
    ($, _, React, ReactDOM, RouterDOM, url, ajax, Pure_component, RB, setdb,
    etask, match, country, date, i18n)=>{

const E = {};
const {Modal, Button, Alert} = RB;
const {T} = i18n;

const Foreach = ({children, data})=>data.map((d, i)=>children(d, i));
E.Foreach = Foreach;

const If = ({children, when})=>{
    if (!when)
        return null;
    return (children instanceof Function) ? children() : children;
};
E.If = If;

// XXX saarya: replace Wrap with <> fragment from react 16.2
const Wrap = props=>props.children;
E.Wrap = Wrap;

const Responsive = ({children, when, mobile, no_mobile})=>{
    const is_mobile = $(window).width()<=480;
    if (when=='mobile'&&is_mobile||when=='!mobile'&&!is_mobile)
        return children;
    return is_mobile ? mobile||null : no_mobile||null;
};
E.Responsive = Responsive;

class Popover extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            margin: props.margin==undefined ? 5 : props.margin,
            autoclose: props.autoclose==undefined ? 1 : props.autoclose,
            show_arrows: props.show_arrows,
            shadow: props.shadow==undefined ? 1 : props.shadow,
        };
        this.autoclose = 1;
    }
    autoclose(value){ this.autoclose = value; }
    show(){ this.setState({visible: 1}); }
    toggle(){ this.state.visible ? this.hide() : this.show(); }
    hide(){
        this.setState({visible: 0});
        if (this.props.on_hide)
            this.props.on_hide();
    }
    get_left(w){
        let p = this.props, m = this.state.margin, t = p.target()||{};
        if (p.position=='left')
            return t.offsetLeft-w.offsetWidth-this.state-m;
        if (p.position=='right')
            return t.offsetLeft+t.offsetWidth+m;
        if (p.align=='right')
            return t.offsetLeft+t.offsetWidth-(w.offsetWidth||0);
        if (p.align=='center')
            return t.offsetLeft+t.offsetWidth/2-((w.offsetWidth||0)/2);
        return t.offsetLeft;
    }
    get_top(w){
        let p = this.props, m = this.state.margin, t = p.target()||{};
        if (p.position=='top')
            return t.offsetTop-w.offsetHeight-m;
        if (p.position=='bottom')
            return t.offsetTop+t.offsetHeight+m;
        if (p.align=='top')
            return t.offsetTop;
        if (p.align=='middle')
            return t.offsetTop+t.offsetHeight/2-(w.offsetHeight||0)/2;
        return t.offsetTop+(t.offsetHeight||0)+m;
    }
    max_z_index(){
        return Array.from(document.querySelectorAll('body *'))
            .map(a=>parseFloat(window.getComputedStyle(a).zIndex))
            .filter(a=>!isNaN(a)).sort().pop();
    }
    content(){
        return (
            <div className="ru_panel rutils_boxshadow">
              {this.props.children}
            </div>
        );
    }
    render(){
        let z = this.max_z_index(), p = this.props;
        let wrapper_bind = r=>{
            if (!r || !p.target)
                return;
            this.wrapper = r;
            r.style.top = this.get_top(r)+'px';
            r.style.left = this.get_left(r)+'px';
        };
        return (
            <If when={this.state.visible}>
              <div ref={r=>wrapper_bind(r)}
                className="rutils_popover"
                style={{zIndex: z+2}}>
                <If when={this.state.show_arrows
                  && (p.position=='bottom' || !p.position)}>
                  <div>
                    <div className="arrow-up"></div>
                  </div>
                </If>
                {this.content()}
                <If when={this.state.show_arrows && p.position=='top'}>
                  <div>
                    <div className="arrow-down"></div>
                  </div>
                </If>
              </div>
              <If when={this.state.autoclose}>
                <div className="rutils_transparent_overflow"
                  onClick={()=>this.hide()}>
                  &nbsp;
                </div>
              </If>
            </If>
        );
    }
}
E.Popover = Popover;

E.Paginator = class Paginator extends Pure_component {
    constructor(props){ super(props); }
    click(v){
        if (!this.props.on_click)
            return;
        this.props.on_click({
            page_size: this.props.page_size,
            current_page: v,
        });
    }
    render(){
        let minv, max, first, last, middle_l, middle_r, page_count;
        let p = this.props, {ceil, min, floor} = Math;
        p.current_page = p.current_page||1;
        p.page_size = p.page_size||50;
        page_count = ceil(p.items_count/p.page_size);
        if (page_count<6)
        {
            minv = 1;
            max = min(5, page_count);
        }
        else
        {
            if (p.current_page<5)
            {
                minv = middle_r = last = 1;
                max = 5;
            }
            else if (page_count-p.current_page<4)
            {
                minv = page_count-5;
                max = page_count;
                first = middle_l = 1;
            }
            else
            {
                minv = p.current_page-1;
                max = p.current_page+1;
                first = last = middle_l = middle_r = 1;
            }
        }
        let arr = [...Array(floor(max-minv)+1).keys()]
            .map(p=>Math.floor(p+minv));
        let on_size_changed = v=>p.on_click({page_size: +v.target.value,
            current_page: 1});
        return (
            <div className="rutils_paginator">
                <div className="left_col">
                    <span className="ru_pr_btn_group">
                    <If when={first}>
                      <a className="ru_pr_btn"
                        onClick={()=>this.click(1)}>1</a>
                    </If>
                    <If when={middle_l}>
                      <span className="ru_pr_btn">...</span>
                    </If>
                    <Foreach data={arr}>{v=>(
                      <a className={'ru_pr_btn '+(v==p.current_page
                        ? 'ru_pr_btn_selected' : '')}
                        onClick={()=>this.click(v)}>{v}</a>)}
                    </Foreach>
                    <If when={middle_r}>
                        <span className="ru_pr_btn">...</span>
                    </If>
                    <If when={last}>
                      <a className="ru_pr_btn"
                        onClick={()=>this.click(page_count)}>
                        {page_count}
                      </a>
                    </If>
                    <If when={p.current_page!==page_count}>
                      <a className="ru_pr_btn"
                        onClick={()=>this.click(p.current_page+1)}>Next
                      </a>
                    </If>
                  </span>
                </div>
                <div className="center_col">
                  <If when={p.custom_controls}>{()=>p.custom_controls()}</If>
                </div>
                <div className="right_col">
                  <label>
                      <select className="form-control dropdown"
                      value={p.page_size} onChange={on_size_changed}>
                      <Foreach data={[10, 20, 50, 100, 200, 500, 1000]}>{v=>(
                          <option value={v}>{v}</option>)}
                      </Foreach>
                      </select>
                  </label>
                  <strong>{1+(p.current_page-1)*p.page_size}
                      -{p.current_page==page_count ? p.items_count
                      : p.current_page*p.page_size}</strong>
                      &nbsp;of <strong>{p.items_count}</strong>
                </div>
            </div>
        );
    }
};

let sitemap = {};
class Nav_hook extends Pure_component {
    constructor(props){
        super(props);
        this.reset = this.reset.bind(this);
    }
    componentDidMount(){
        const p = this.props;
        const l = this.props.location;
        if (p.hash_scroll&&l.hash)
            this.hash_scroll(l.hash);
        if (this.props.sitemap)
            this.etask([()=>ajax.json({url: p.sitemap}), sm=>sitemap = sm]);
    }
    componentDidUpdate(prevProps){
        if (this.props.location == prevProps.location)
            return;
        const p = this.props;
        const l = this.props.location;
        const url_o = url.parse(l.href);
        if (p.update_meta)
            this.set_meta(url_o.pathname);
        if (p.scroll_to_top&&!l.hash)
            window.scrollTo(0, 0);
        if (p.hash_scroll&&l.hash)
            this.hash_scroll(l.hash);
        if (p.ga&&window.ga)
        {
            window.ga('set', 'page', l.pathname);
            window.ga('send', 'pageview');
        }
        if (p.on_nav)
            p.on_nav(url_o);
    }
    add_domain(path){
        return this.props.domain&&`https://${this.props.domain}${path}`||path;
    }
    set_meta(pathname){
        let m;
        for (let key in sitemap)
        {
            if (!match.match(key, pathname.toLowerCase(), {glob: 1}))
                continue;
            m = sitemap[key];
            break;
        }
        if (!m)
            return;
        m.og_url = this.add_domain(m.og_url||pathname);
        m.og_image = m.og_image&&this.add_domain(m.og_image);
        $('title').text(m.title);
        $('meta[name="description"]').attr('content', m.description);
        $('meta[property="og:url"]').attr('content', m.og_url);
        $('link[rel="canonical"]').attr('href', m.og_url);
        $('meta[property="og:title"]').attr('content', m.og_title);
        $('meta[property="og:description"]').attr('content', m.og_description);
        $('meta[property="og:image"]').attr('content', m.og_image);
        $('script[type="application/ld+json"]')
            .text(JSON.stringify(m.json_ld));
        $('meta[content=noindex]').remove();
        m.ga_num!==undefined&&window.set_ga_num&&window.set_ga_num(m.ga_num);
    }
    hash_scroll(hash){
        const el = $(hash);
        return el[0]&&(el[0].scrollIntoView()||true);
    }
    reset(){
        this.observer&&this.observer.disconnect();
        this.timeout&&clearTimeout(this.timeout);
        this.observer = this.timeout = null;
    }
    render(){ return this.props.children; }
}
E.Nav_hook = RouterDOM.withRouter(Nav_hook);

// XXX viktor: wrap_in_div is ugly but it is needed to attach mouse event to
// XXX viktor: since most of the React components swallow events
const Tooltip = props=>{
    const {tip} = props;
    if (!tip)
        return props.children;
    const is_react_child =
        typeof React.Children.only(props.children).type == 'function';
    const tooltip = <RB.Tooltip id="tooltip" {...props.tooltip_props}>
      {tip}</RB.Tooltip>;
    let children = props.children;
    if (props.wrap_in_div)
        children = <div>{children}</div>;
    else if (is_react_child)
        children = <span style={{display: 'inline-block'}}>{children}</span>;
    return <RB.OverlayTrigger placement={props.placement||'top'}
          overlay={tooltip}>
          {children}
        </RB.OverlayTrigger>;
};
E.Tooltip = Tooltip;

class Alerts extends Pure_component {
    constructor(props){
        super(props);
        this.state = {alerts: []};
    }
    componentWillMount(){
        this.setdb_on('alerts', alerts=>this.setState({alerts: alerts||[]}));
    }
    render(){
        return (
            <div className="alerts_container">
              {this.state.alerts.map(a=><Alert key={a.key} {...a}/>)}
            </div>);
    }
    static key = 0;
    static push(children, opt){
        opt = opt||{};
        if (opt.dismissable&&opt.id&&(setdb.get('alerts')||[]).some(
            a=>a.id==opt.id))
        {
            return;
        }
        let alert = {bsStyle: opt.type||'danger', children, key: Alerts.key++,
            id: opt.id};
        const dismiss = ()=>setdb.set('alerts', setdb.get('alerts')
            .filter(a=>a!=alert));
        if (opt.dismissable)
            alert.onDismiss = dismiss;
        else
            setTimeout(dismiss, opt.duration||2000);
        const max_len = 3;
        let alerts = [...(setdb.get('alerts')||[]).slice(-max_len+1), alert];
        setdb.set('alerts', alerts);
    }
}
['success', 'warning', 'danger', 'info'].forEach(type=>Alerts[type] =
    (children, opt)=>Alerts.push(children, {type, ...opt}));
E.Alerts = Alerts;

class Confirm extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){ this.setdb_on('confirm', this.setState.bind(this)); }
    render(){
        let {show, confirm, cancel, title, content, only_yes, confirm_label,
            cancel_label, are_you_sure} = this.state;
        return <Modal show={show} onHide={only_yes ? confirm : cancel}>
              <Modal.Header closeButton>
                <Modal.Title>{title}
                  <br/>
                  {!are_you_sure ? null : <T>Are you sure?</T>}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>{content}</Modal.Body>
              <Modal.Footer>{only_yes ? null :
                <Button onClick={cancel}>
                  {cancel_label||<T>Cancel</T>}</Button>}
                <Button bsStyle="primary" onClick={confirm}>
                  {confirm_label||(only_yes ? <T>OK</T> : <T>Yes</T>)}</Button>
              </Modal.Footer>
            </Modal>;
    }
    static modal(props){
        return etask(function(){
            if (setdb.get('confirm.show'))
                setdb.get('confirm.cancel')();
            const close = ()=>setdb.set('confirm', {show: false});
            const defaults = {title: '', content: '', only_yes: false,
                confirm_label: '', cancel_label: '', are_you_sure: true};
            setdb.set('confirm', {show: true,
                confirm: ()=>{
                    this.return(true);
                    close();
                },
                cancel: ()=>{
                    this.return(false);
                    close();
                },
                ...defaults,
                ...props
            });
            return this.wait();
        });
    }
}
E.Confirm = Confirm;

class Phone_number_input extends Pure_component {
    constructor(props){
        super(props);
        this.countries = _.map(country.list,
            (label, value)=>this.get_country(value)).filter(c=>c);
        this.state = {is_select_open: false, body: '', filter: ''};
        let number, parsed;
        if ((number = props.value) && (parsed = this.parse_number(number)))
        {
            this.state.country = this.get_country(parsed.country);
            this.state.body = parsed.body;
        }
        const user_country = setdb.get('login.user.country');
        if (!this.state.country && user_country)
            this.state.country = this.get_country(user_country);
        this.on_change = this.on_change.bind(this);
        this.on_blur = this.on_blur.bind(this);
        this.open_select = this.open_select.bind(this);
        this.input_ref = this.input_ref.bind(this);
    }
    componentWillReceiveProps(next_props){
        let number, parsed;
        if (number = next_props.value)
        {
            if (parsed = this.parse_number(number))
            {
                this.setState({country: this.get_country(parsed.country),
                    body: parsed.body});
            }
        }
    }
    parse_number(number){
        let cur_country, cur_code;
        if (this.state.country)
        {
            cur_country = this.state.country.value;
            cur_code = this.state.country.code;
        }
        if (cur_country && number.startsWith('+'+cur_code))
        {
            const body = number.substr(cur_code.length+1);
            return {country: cur_country, code: cur_code, body: body.trim()};
        }
        for (let c in country.dialing_code_list)
        {
            const code = country.dialing_code_list[c];
            if (number.startsWith('+'+code))
            {
                const body = number.substr(code.length+1);
                return {country: c, code, body: body.trim()};
            }
        }
    }
    get_country(c){
        const code = country.dialing_code_list[c];
        if (code)
            return {value: c, label: country.list[c], code};
    }
    open_select(){
        this.setState({is_select_open: true});
        this.start_search();
        $(document).one('mousedown', e=>{
            if ($(e.target).closest(this.country_list).length)
                return;
            this.setState({is_select_open: false});
            this.stop_search();
        });
    }
    start_search(){
        this.stop_search();
        $(document).on('keydown', this.search_listener = e=>{
            let filter = this.state.filter;
            if (e.which==8)
                filter = filter.slice(0, filter.length-1);
            else if (e.which>=65 && e.which<=120)
                filter = filter+e.key;
            this.setState({filter: filter.toLowerCase()});
        });
    }
    stop_search(){
        this.setState({filter: ''});
        $(document).off('keydown', this.search_listener);
    }
    get_event(){
        const {country, body} = this.state;
        return {value: `+${country.code} ${body}`};
    }
    select_country(c){
        this.setState({body: '', country: c, is_select_open: false}, ()=>{
            if (c && this.props.onChange)
                this.props.onChange(this.get_event());
            this.input.focus();
        });
    }
    on_change(e){
        let value = e.target.value;
        if (value[0]=='0')
            value = '(0)'+value.slice(1).replace(/[()]/g, '');
        this.setState({body: value}, ()=>{
            if (this.state.country && this.props.onChange)
                this.props.onChange(this.get_event());
        });
    }
    on_blur(e){
        if (this.state.country && this.props.onBlur)
            this.props.onBlur(this.get_event());
    }
    input_ref(el){
        this.input = el;
        if (this.props.input_ref)
            this.props.input_ref(el);
    }
    render(){
        let {is_select_open, country, body, filter} = this.state;
        country = country||this.get_country('US');
        const countries = is_select_open && this.countries.filter(c=>{
            if (!filter)
                return true;
            if (c.value.toLowerCase()==filter)
                return true;
            if (country.value==c.value)
                return true;
            if (c.label.split(' ').some(l=>l.toLowerCase().startsWith(filter)))
                return true;
        }).map(c=>{
            return (
                <li key={c.value} onClick={()=>this.select_country(c)}>
                  <span className="f19">
                    <span className={'flag '+c.value.toLowerCase()}/>
                  </span>
                  {c.label}
                  <i>+{c.code}</i>
                </li>
            );
        });
        const input_class = 'form-control '+(this.props.className||'');
        return (
            <div className="phone_number_input">
              <div className="flag_container">
                <div className="selected_flag f19" onClick={this.open_select}
                  title={country.label+': +'+country.code}>
                  <span className={'flag '+country.value.toLowerCase()}/>
                  <span className="selected_code">+{country.code}</span>
                  <span className="arrow"></span>
                </div>
                <If when={is_select_open}>
                  <ul className="country_list"
                    ref={el=>this.country_list = el}>
                    {countries}
                  </ul>
                </If>
              </div>
              <input type="tel" className={input_class}
                ref={this.input_ref}
                placeholder="(201) 555-5555" value={body}
                onChange={this.on_change} onBlur={this.on_blur}
                style={{paddingLeft: 53+country.code.length*8}}/>
            </div>
        );
    }
}
E.Phone_number_input = Phone_number_input;

class Clipboard extends Pure_component {
    constructor(props){
        super(props);
        Clipboard.copy = this.copy.bind(this);
        this.set_textarea = this.set_textarea.bind(this);
    }
    set_textarea(element){ this.textarea = element; }
    copy(text){
        this.textarea.value = text;
        const area = $(this.textarea);
        area.select();
        try {
            document.execCommand('copy');
            return true;
        }
        catch(e){ return void console.log('Oops, unable to copy'); }
    }
    render(){
        return (
            <textarea ref={this.set_textarea} className="copy_fake_area"/>);
    }
}
E.Clipboard = Clipboard;

class Copy_tooltip extends Pure_component {
    constructor(props){
        super(props);
        this.state = {copied: false};
        this.clr_copy = this.clr_copy.bind(this);
        this.copy = this.copy.bind(this);
    }
    clr_copy(){ this.setState({copied: false}); }
    copy(){
        let text = this.props.text;
        if (typeof text == 'function')
            text = text();
        if (!text || !Clipboard.copy(text))
            return this.props.on_fail&&this.props.on_fail();
        this.setState({copied: true});
        if (this.props.on_copy)
            this.props.on_copy();
    }
    render(){
        const p = this.props;
        const click_msg = p.click_msg || <T>Click to copy</T>;
        const copied_msg = p.copied_msg || <T>Copied!</T>;
        return (
            <Tooltip key={this.state.copied} {...p.tooltip_props}
              tooltip_props={{style: {whiteSpace: 'nowrap'}}}
              tip={this.state.copied ? copied_msg : click_msg}>
              <span className="copy_hover_area" onClick={this.copy}
                onMouseOut={this.clr_copy}>
                {p.children}</span>
            </Tooltip>);
    }
}
E.Copy_tooltip = Copy_tooltip;

const Raw_text = props=>props.children.split('\n')
    .map((line, i)=><div key={i}>{line}</div>);
E.Raw_text = Raw_text;

const clean_phonenum = phone_number=>phone_number.replace(/[^+\d]/g, '');

class Phone_number_form extends Pure_component {
    constructor(props){
        super(props);
        const {phone_number} = props;
        this.state = {phone_number};
    }
    get_clear_phonenum(){
        if (this.state.phone_number)
            return clean_phonenum(this.state.phone_number);
    }
    validate_phone(){
        this.setState({is_phone_valid: /^(\+|00)[1-9][0-9]{3,14}$/
            .test(this.get_clear_phonenum())});
    }
    on_phone_change(event){
        this.setState({phone_number: event.value});
        if (this.props.on_change)
            this.props.on_change(event.value);
    }
    phone_ref(inp){
        this.etask(function*(){
            yield etask.sleep(1000);
            if (inp)
                inp.focus();
        });
    }
    on_fail(error){
        this.setState({error: error||'An error occured'}); }
    submit_phone(event){
        event.preventDefault();
        const phone_number = this.state.phone_number;
        if (!phone_number)
            return;
        const {customer} = this.props;
        const _this = this;
        this.etask(function*(){
            _this.props.wait_et(this);
            let res;
            try {
                res = yield ajax({method: 'POST', url: '/users/submit_phone',
                    qs: {customer}, json: 1, data: {phone_number}});
            } catch(e){ return void _this.on_fail(); }
            if (res && res.invalid_phone_number)
            {
                return _this.on_fail('International format expected, '
                    +'e.g +1-012-345-6789');
            }
            if (!res)
                return void _this.on_fail();
            _this.props.on_submit(phone_number, res.need_verify);
        });
    }
    render(){
        const {phone_number, error} = this.state;
        return (
            <form onSubmit={event=>this.submit_phone(event)}
              className={'phone_number_form '+(error ? 'invalid' : '')}>
              <label><T>Enter your phone number</T></label>
              <Phone_number_input value={phone_number}
                input_ref={pnum=>this.phone_ref(pnum)}
                onChange={e=>this.on_phone_change(e)}/>
              <button className={'lum_btn '
                  +(this.get_clear_phonenum() ? '' : 'disabled')}
                type="submit">
                <T>Submit</T>
              </button>
              {error && <label className="invalid"><T>{error}</T></label>}
            </form>
        );
    }
}
E.Phone_number_form = Phone_number_form;

class Verification_code_form extends Pure_component {
    constructor(props){
        super(props);
        this.state = {code: {}, disable_code_resend: true};
        this.code_refs = {};
        this.code_format = [0, 1, 2, '-', 3, 4, 5];
    }
    componentDidMount(){
        let _this = this;
        this.etask(function*(){
            yield etask.sleep(500);
            if (_this.code_refs[0])
                _this.code_refs[0].focus();
            yield etask.sleep(10000);
            _this.setState({disable_code_resend: false});
        });
    }
    on_fail(error){
        this.setState({error: error||'An error occured', code: {}}, ()=>{
            setTimeout(()=>this.code_refs[0].focus(), 200); });
    }
    set_code_ref(i, inp){
        this.code_refs[i] = inp; }
    on_code_change(i, e){
        let ch = e.target.value;
        ch = ch[ch.length-1];
        this.setState(prev_state=>{
            return {code: Object.assign({}, prev_state.code, {[i]: ch})};
        }, ()=>{
            if (!ch)
                return;
            const next_ref = this.code_refs[i+1];
            if (next_ref)
                next_ref.focus();
            else
                this.submit_code();
        });
    }
    on_code_key_down(i, e){
        if (e.keyCode!=8 || this.state.code[i])
            return;
        const next_ref = this.code_refs[i-1];
        if (next_ref)
            next_ref.focus();
    }
    submit_code(event){
        if (event)
            event.preventDefault();
        let code = '';
        for (let i of this.code_format)
        {
            if (typeof i=='string')
                code += i;
            else if (!this.state.code[i])
                return this.code_refs[i].focus();
            else
                code += this.state.code[i];
        }
        const {customer} = this.props;
        const _this = this;
        this.etask(function*(){
            _this.props.wait_et(this);
            let res;
            try {
                res = yield ajax({method: 'POST', slow: 15*date.ms.SEC,
                    url: '/users/verify_phone', qs: {customer}, json: 1,
                    data: {code}});
            } catch(e){ return _this.on_fail(); }
            if (res && res.wrong_code)
                return _this.on_fail('The code you entered was incorrect');
            if (!res || !res.ok)
                return _this.on_fail();
            _this.props.on_verify();
        });
    }
    resend_code(){
        if (this.state.disable_code_resend)
            return;
        this.setState({disable_code_resend: true});
        const {customer} = this.props;
        const _this = this;
        this.etask(function*(){
            yield ajax({method: 'POST', slow: 15*date.ms.SEC,
                url: '/users/resend_phone_verification_code',
                qs: {customer}, json: 1, no_throw: 1});
            yield etask.sleep(30*date.ms.SEC);
            _this.setState({disable_code_resend: false});
        });
    }
    change_phone_number(){
        this.setState({code: {}});
        if (this.props.on_change_phone_number)
            this.props.on_change_phone_number();
    }
    render(){
        const {disable_code_resend, error, code} = this.state;
        const inputs = this.code_format.map(i=>{
            if (typeof i=='string')
                return <span key={i} className="dash">–</span>;
            return (
                <input type="text" key={i} autoFocus={i==0} value={code[i]||''}
                  ref={pnum=>this.set_code_ref(i, pnum)}
                  onChange={e=>this.on_code_change(i, e)}
                  onKeyDown={e=>this.on_code_key_down(i, e)}/>
            );
        });
        return (
            <form onSubmit={event=>this.submit_code(event)}
              className={'verification_code_form '+(error ? 'invalid' : '')}>
              <label><T>Enter the code you received</T></label>
              {inputs}
              <input type="submit" className="hide"/>
              {error && <label className="invalid"><T>{error}</T></label>}
              <div className="phone_signup_links">
                <a onClick={()=>this.change_phone_number()}
                  className="btn btn-link">
                  Change phone number</a>
                |
                <a onClick={()=>this.resend_code()}
                  className={'btn btn-link '+
                    (disable_code_resend ? 'disabled' : '')}>
                  Resend code</a>
              </div>
            </form>
        );
    }
}
E.Verification_code_form = Verification_code_form;

class Phone_number_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {waiting: 0};
        _.bindAll(this, ['on_phone_change', 'on_phone_submit',
            'on_phone_verified']);
    }
    componentDidMount(){
        let _this = this;
        this.setdb_on('phone_number_modal', props=>{
            this.setState({
                waiting: 0,
                submited_phone: false,
                verified_phone: false,
                ...props,
            }, s=>etask(function*(){
                if (s.phone_number)
                {
                    const res = yield _this.submit_phone(s.phone_number);
                    if (res)
                        _this.on_phone_submit(s.phone_number, res.need_verify);
                }
            }));
        }, {init: false});
    }
    submit_phone(phone_number){
        const {customer} = this.state;
        const _this = this;
        return this.etask(function*(){
            _this.wait_et(this);
            let res;
            try {
                res = yield ajax({method: 'POST', url: '/users/submit_phone',
                    qs: {customer: customer.customer_name}, json: 1,
                    data: {phone_number}});
            } catch(e){ return false; }
            if (res && res.need_verify)
                return {need_verify: true};
            return res && res.ok;
        });
    }
    wait_et(et){
        this.setState(prev_state=>({waiting: prev_state.waiting+1}));
        et.finally(()=>
            this.setState(prev_state=>({waiting: prev_state.waiting-1})));
    }
    on_phone_submit(phone_number, need_verify){
        this.setState({submited_phone: phone_number});
        if (!need_verify)
            this.state.confirm({phone_number});
    }
    on_phone_change(phone_number){
        this.setState({phone_number});
    }
    on_phone_verified(){
        this.state.confirm({phone_number: this.state.phone_number});
    }
    render(){
        let {show, cancel, customer, title, waiting} = this.state;
        let body;
        if (!customer)
            body = null;
        else if (this.state.submited_phone)
        {
            let on_change_phone = ()=>this.setState({submited_phone: false});
            body = <Verification_code_form customer={customer.customer_name}
                on_verify={this.on_phone_verified}
                wait_et={et=>this.wait_et(et)}
                on_change_phone_number={on_change_phone}/>;
        }
        else if (!this.state.verified_phone)
        {
            body = <Phone_number_form customer={customer.customer_name}
                phone_number={this.state.phone_number||customer.phone}
                wait_et={et=>this.wait_et(et)}
                on_change={this.on_phone_change}
                on_submit={this.on_phone_submit}/>;
        }
        return <Modal show={show} onHide={cancel}
              dialogClassName={'phone_number_modal '+
                (waiting ? 'phone_number_modal_waiting' : '')}>
              <Modal.Header closeButton>
                <Modal.Title>
                  <T>{title||'Verify your phone number'}</T>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="waiting"></div>
                <div className="hide_on_waiting">{body}</div>
              </Modal.Body>
            </Modal>;
    }
    static verify(customer, phone_number){
        if (arguments.length==1)
            phone_number = customer.phone;
        const verified_phones = customer.verified_phones||[];
        if (phone_number && verified_phones.some(phone=>
            clean_phonenum(phone)==clean_phonenum(phone_number)))
        {
            return {phone_number};
        }
        return etask(function*(){
            if (setdb.get('phone_number_modal.show'))
                setdb.get('phone_number_modal.cancel')();
            const close = ()=>setdb.set('phone_number_modal', {show: false});
            setdb.set('phone_number_modal', {show: true, phone_number,
                customer,
                confirm: res=>{
                    this.return(res);
                    close();
                },
                cancel: ()=>{
                    this.return(false);
                    close();
                },
            });
            return yield this.wait();
        });
    }
}
E.Phone_number_modal = Phone_number_modal;

return E;

});
