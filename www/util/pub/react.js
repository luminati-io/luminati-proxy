// LICENSE_CODE ZON
'use strict'; /*jslint react:true*/
define(['virt_jquery_all', 'react', 'react-dom', 'react-router-dom',
    '/util/url.js', '/util/ajax.js', '/www/util/pub/pure_component.js',
    'react-bootstrap', '/util/setdb.js', '/util/etask.js',
    '/www/locale/pub/i18n_react.js'], ($, React, ReactDOM, RouterDOM, url,
    ajax, Pure_component, RB, setdb, etask, {T})=>{

const E = {};
const {Modal, Button} = RB;

const Foreach = ({children, data})=>data.map((d, i)=>children(d, i));
E.Foreach = Foreach;

const If = ({children, when})=>{
    if (!when)
        return null;
    return (children instanceof Function) ? children() : children;
};
E.If = If;

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
        const m = sitemap[pathname];
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
        if (m.noindex)
            $('head').append('<meta name=robots content=noindex>');
        else
            $('meta[name=robots]').remove();
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
    render(){return this.props.children;}
}
E.Nav_hook = RouterDOM.withRouter(Nav_hook);

const Tooltip = props=>{
    const {tip, children} = props;
    if(!tip)
        return props.children;
    const is_react_child =
        typeof React.Children.only(children).type == 'function';
    const tooltip = <RB.Tooltip id="tooltip" {...props.tooltip_props}>
      {tip}</RB.Tooltip>;
    return <RB.OverlayTrigger placement={props.placement||'top'}
        overlay={tooltip}>
        {!is_react_child ? children
          : <span style={{display: 'inline-block'}}>{children}</span>}
        </RB.OverlayTrigger>;
};
E.Tooltip = Tooltip;

const Alert = ({text, type})=>(
    <div className={'alert alert-'+(type||'danger')} role="alert">{text}</div>
);
E.Alert = Alert;
class Alerts extends Pure_component {
    constructor(props){
        super(props);
        this.state = {alerts: []};
    }
    componentWillMount(){
        this.setdb_on('alerts', alerts=>this.setState({alerts: alerts||[]}));
    }
    render() { return this.state.alerts.map(a=><Alert key={a.key} {...a}/>); }
    static key = 0;
    static push(text, opt){
        let alert = {...opt, text, key: Alerts.key++};
        const max_len = 3;
        let alerts = [...(setdb.get('alerts')||[]).slice(-max_len+1), alert];
        setdb.set('alerts', alerts);
        const duration=alert.duration||2000;
        setTimeout(()=>setdb.set('alerts', setdb.get('alerts')
            .filter(a=>a!=alert)), duration);
    }
}
E.Alerts = Alerts;

class Confirm extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){ this.setdb_on('confirm', this.setState.bind(this)); }
    render(){
        let {show, confirm, cancel, title, content} = this.state;
        return <Modal show={show} onHide={cancel}>
              <Modal.Header closeButton>
                <Modal.Title>{title}
                  <br/>
                  <T>Are you sure?</T>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>{content}</Modal.Body>
              <Modal.Footer>
                <Button onClick={cancel}>
                  <T>Cancel</T></Button>
                <Button onClick={confirm}>
                  <T>Yes</T></Button>
              </Modal.Footer>
            </Modal>;
    }
    static modal(props){
        return etask([function()
    {
        if (setdb.get('confirm.show'))
            setdb.get('confirm.cancel')();
        const close = ()=>setdb.set('confirm', {show: false});
        setdb.set('confirm', {show: true,
            confirm: ()=>{
                this.return(true);
                close();
            },
            cancel: ()=>{
                this.return(false);
                close();
            },
            ...props
        });
        return this.wait();
    }]);
    }
}
E.Confirm = Confirm;

return E;

});
