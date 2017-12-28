// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Row, Col} from 'react-bootstrap';
import {Input, Select, If} from './common.js';
import classnames from 'classnames';

class Index extends React.Component {
    render(){
        return (
            <div className="lpm proxy_tester">
              <Nav/>
              <Request/>
              <Body/>
              <Row>
                <Col md={4}><Info/></Col>
                <Col md={8}><Response/></Col>
              </Row>
            </div>
        );
    }
}

const Nav = ()=>(
    <div className="nav_header">
      <h3>Proxy Tester</h3></div>
);

const Request = ()=>(
    <div className="panel request">
      <div className="panel_body">
        <Request_params/>
        <Headers headers={[1, 2]}/>
        <Add_header_btn/>
      </div>
    </div>
);

const Add_header_btn = ()=>(
    <div className="add_header_wrapper">
      <button className="btn btn_lpm btn_lpm_normal btn_add_header">
        Add header</button>
    </div>
);

const Headers = props=>(
    <div className="headers">
      {props.headers.map((h, idx)=><New_header_params key={idx}/>)}</div>
);

const New_header_params = ()=>(
    <div className="header_line">
      <Input type="text" placeholder="Header" className="header_input"/>
      <Input type="text" placeholder="Value" className="value_input"/>
      <button className="btn btn_lpm btn_lpm_error">Remove</button>
    </div>
);

const Request_params = ()=>{
    const proxies = [{key: '24000', value: '24000'},
          {key: '24001', value: '240001'}];
    const methods = [{key: 'GET', value: 'get'}, {key: 'POST', value: 'post'}];
    return (
        <div className="request_params">
          <Field name="proxy" type="select" data={proxies}/>
          <Field name="url" type="text"/>
          <Field name="method" type="select" data={methods}/>
        </div>
    );
};

const Field = ({type, ...props})=>{
    const fields = {proxy: 'Proxy', url: 'URL', method: 'Method'};
    let Comp;
    if (type=='select')
        Comp = <Select {...props}/>;
    else
        Comp = <Input type={type} {...props}/>;
    const title = fields[props.name];
    return (
        <div className={classnames('field', props.name)}>
          <If when={title}>
            <div className="title">{fields[props.name]}</div>
          </If>
          {Comp}
        </div>
    );
};

const Body = ()=>(
    <div className="panel body">
      <div className="panel_heading">
        <h2>Body</h2>
      </div>
      <div className="panel_body">
        <div className="panel code">
          <div className="panel_body">
            <span>
              {`{"ip":"158.46.203.119","country":"IN","asn":{"asnum":57129,
              "org_name":"Optibit LLC"},"geo":{"city":"Chennai","region":"TN",
              "postal_code":"","latitude":13.0833,"longitude":80.2833,"tz":
              "Asia/Kolkata"}}`}
            </span>
          </div>
        </div>
      </div>
    </div>
);

const Title_value_pairs = props=>(
    <div className="title_value_pairs">
      {props.pairs.map((p, idx)=>(
        <Pair key={idx} title={p.title} value={p.value}/>))}
    </div>
);

const Pair = props=>(
    <div className="pair">
      <div className="key">{props.title}</div>
      <div className="value">{props.value}</div>
    </div>
);

const Info = ()=>{
    const pairs = [{title: 'HTTP Version', value: '1.1'},
        {title: 'Response status code', value: '200'},
        {title: 'Response status message', value: 'OK'},
    ];
    return (
        <div className="panel info">
          <div className="panel_heading">
            <h2>Info</h2>
          </div>
          <div className="panel_body">
            <Title_value_pairs pairs={pairs}/>
          </div>
        </div>
    );
};

const Response = ()=>{
    const pairs = [
        {title: 'cache-control', value: 'no-store'},
        {title: 'connection', value: 'close'},
        {title: 'content-length', value: '200'},
        {title: 'content-type', value: 'application/json; charset=utf-8'},
        {title: 'date', value: 'Wed, 15 Nov 2017 15:07:47 GMT'},
        {title: 'x-hola-context', value: 'PROXY TESTER TOOL'},
        {title: 'x-hola-ip', value: '158.46.203.119'},
        {title: 'x-hola-timeline-debug', value: 'ztun 943ms z672 158.46.203.119 xx zgc xx.pool_route z672'},
        {title: 'x-lpm-authorization', value: 'lum-customer-hl_0f86d21e-zone-static-session-22225_127_0_0_1_193ff7b915180b_1'},
        {title: 'x-luminati-timeline', value: 'init:0,auth:1,dns_resolve:0,ext_conn:0,ext_proxy_connect:565,response:377'},
    ];
    return (
        <div className="panel response">
          <div className="panel_heading">
            <h2>Response headers</h2>
          </div>
          <div className="panel_body">
            <Title_value_pairs pairs={pairs}/>
          </div>
        </div>
    );
};

export default Index;
