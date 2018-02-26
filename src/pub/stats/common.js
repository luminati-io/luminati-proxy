// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import moment from 'moment';
import React from 'react';
import {Col, Table, Pagination} from 'react-bootstrap';
import axios from 'axios';
import etask from 'hutil/util/etask';
import util from '../util.js';
import classnames from 'classnames';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react_util.js';
import $ from 'jquery';

class StatTable extends React.Component {
    render(){
        const Row = this.props.row;
        return <div>
              <h4>
                {this.props.title}
                {this.props.show_more &&
                  <small>&nbsp;<a href={this.props.path}>show all</a></small>}
              </h4>
              <Table hover condensed>
                <thead>{this.props.children}</thead>
                <tbody>
                  {this.props.stats.map(s=>
                    <Row stat={s} key={s[this.props.row_key||'key']}
                      path={this.props.path} go={this.props.go}
                      {...(this.props.row_opts||{})}/>)}
                </tbody>
              </Table>
            </div>;
    }
}

class StatsService {
    static base = '/api/request_stats';
    static get_top = etask._fn(function*(_this, opt = {}){
        const res = yield _this.get('top'), assign = Object.assign;
        opt = assign({reverse: true}, opt);
        let state = _.reduce(res, (s, v, k)=>{
            if (_.isInteger(+k))
                return s.statuses.stats.push(assign({status_code: k,
                    value: v.count, bw: v.bw}, v)) && s;
            if (['http', 'https'].includes(k))
            {
                return s.protocols.stats.push(assign({protocol: k, bw: v.bw,
                    value: v.count}, v)) && s;
            }
            return s.domains.stats.push(assign({hostname: k, value: v.count,
                bw: v.bw}, v)) && s;
        }, {statuses: {stats: []}, domains: {stats: []},
            protocols: {stats: []}});
        if (opt.sort||opt.limit)
        {
            for (let k of ['statuses', 'domains', 'protocols'])
            {
                state[k] = {
                    has_more: state[k].stats.length>(opt.limit||Infinity),
                    stats: _(state[k].stats),
                };
                if (opt.sort)
                {
                    state[k].stats = state[k].stats.sortBy(
                        _.isString(opt.sort)&&opt.sort||'value');
                }
                if (opt.limit)
                {
                    state[k].stats = state[k].stats['take'
                        +(opt.reverse&&'Right'||'')](opt.limit);
                }
                if (opt.reverse)
                    state[k].stats = state[k].stats.reverse();
                state[k].stats = state[k].stats.value();
            }
        }
        return state;
    });
    static get_all = etask._fn(function*(_this, opt = {}){
        opt = Object.assign({reverse: 1}, opt);
        let res = yield _this.get('all');
        if (opt.by)
        {
            res = _(Object.values(res.reduce((s, v, k)=>{
                let c = v[opt.by];
                s[c] = s[c]||Object.assign({value: 0, bw: 0}, v);
                s[c].value += 1;
                s[c].bw += v.bw;
                return s;
            }, {})));
        }
        else
            res = _(res);
        if (opt.sort)
            res = res.sortBy(_.isString(opt.sort)&&opt.sort||'value');
        if (opt.reverse)
            res = res.reverse();
        return res.value();
    });
    static reset = etask._fn(function*(_this){
        let resps = yield etask.all([
            _this.get('reset'),
            axios.get(`/api/proxy_stats/reset`),
        ]);
        return resps[0];
    });
    static get = etask._fn(function*(_, stats){
        let res = yield etask(()=>axios.get(`${StatsService.base}/${stats}`));
        return res.data[stats];
    });
}

class StatsDetails extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            stats: [],
            all_stats: props.stats||[],
            cur_page: 0,
            items_per_page: props.items_per_page||10,
        };
    }
    componentWillReceiveProps(props){
        let update = {};
        if (props.items_per_page!=this.props.items_per_page)
            Object.assign(update, {items_per_page: props.items_per_page});
        if (props.stats!=this.props.stats)
        {
            Object.assign(update, {all_stats: props.stats.map((s, idx)=>{
                s.id = idx;
                return s;
            })});
        }
        if (Object.keys(update).length)
            this.setState(update, ()=>this.paginate());
    }
    componentDidMount(){ this.paginate(); }
    select_req(id){
        this.setState(prev_state=>{
            const req = prev_state.all_stats.filter(s=>s.id==id)[0]||{};
            return {preview_req: req};
        });
    }
    paginate(page = -1){
        page = page > -1 ? page : this.state.cur_page;
        let stats = this.state.all_stats;
        let cur_page = _.min(
            [Math.ceil(stats.length/this.state.items_per_page), page]);
        this.setState({
            stats: stats.slice(cur_page*this.state.items_per_page,
                (cur_page+1)*this.state.items_per_page),
            cur_page,
            preview_req: {},
        });
    }
    page_change = page=>this.paginate(page-1);
    render_headers(headers = {}){
        const hds = Object.keys(headers).map(h=>(
            <div className='request_headers_header' key={h}>
              {h}: {headers[h]}
            </div>
        ));
        return <div className='request_headers'>{hds}</div>;
    }
    render(){
        let pagination = null;
        if (this.state.all_stats.length>this.state.items_per_page)
        {
            let next = false;
            let pages = Math.ceil(this.state.all_stats.length/
                this.state.items_per_page);
            if (this.state.cur_page+1<pages)
                next = 'Next';
            pagination = (
                <Pagination next={next} boundaryLinks
                  activePage={this.state.cur_page+1}
                  bsSize="small" onSelect={this.page_change}
                  items={pages} maxButtons={5}/>
            );
        }
        return <div className="lpm stats">
              <div className="panel top_panel">
                <div className="panel_single_heading">
                  <h3>{this.props.header}</h3>
                </div>
              </div>
              <div>
                <h3 className="top_header">Summary</h3>
                <div className="panel summary_panel">
                  <div className="panel_heading">
                    <h2>Recent Requests</h2>
                  </div>
                  <div className="panel_body">
                    <Requests_table reqs={this.state.stats}
                      select_req={this.select_req.bind(this)}
                      preview_req={this.state.preview_req}/>
                    <div className="pagination_panel">{pagination}</div>
                  </div>
                </div>
                {this.props.children}
              </div>
            </div>;
    }
}

const Requests_table = props=>{
    const reset = ()=>{ props.select_req(null); };
    return (
        <div className="requests_table">
          <If when={props.preview_req&&props.preview_req.id!==undefined}>
            <div onClick={reset} className="x_btn"/>
          </If>
          <Preview_req req={props.preview_req}/>
          <table>
            <thead>
              <tr>
                <th className="fixed_col">Domain</th>
                <th>Code</th>
                <th>Bandwidth</th>
                <th>Date</th>
                <th>Time</th>
                <th>Proxy Peer</th>
              </tr>
            </thead>
            <tbody>
              {props.reqs.map(r=>(
                <Request_row select_req={props.select_req}
                  key={r.id} req={r} preview_id={props.preview_req.id}/>
              ))}
            </tbody>
          </table>
        </div>
    );
};

class Tooltip extends Pure_component {
    componentDidMount(){ $(this.el).tooltip(); }
    ref(el){ this.el = el; }
    render(){
        const {children, title} = this.props;
        return (
            <span style={{display: 'inline-block'}} data-toggle="tooltip"
              data-placement="top" title={title} ref={this.ref.bind(this)}
              data-container="body">
              {children}
            </span>
        );
    }
}

const Request_row = props=>{
    const req = props.req;
    const rh = JSON.parse(req.response_headers);
    const local = moment(new Date(rh.date)).format('YYYY-MM-DD HH:mm:ss');
    const active = props.preview_id==req.id;
    return (
        <tr className={classnames({active})}
          onClick={()=>props.select_req(req.id)}>
          <td className="fixed_col">
            <Tooltip title={req.url}>{req.hostname}</Tooltip>
          </td>
          <td>
            <Tooltip title={req.status_message}>{req.status_code}</Tooltip>
          </td>
          <td>{util.bytes_format(req.bw)}</td>
          <td>{local}</td>
          <td>{req.response_time} ms</td>
          <td>{req.proxy_peer}</td>
        </tr>
    );
};

const Preview_req = props=>{
    if (!props.req||!props.req.status_code)
        return null;
    const {response_headers, request_headers, status_code, url,
        id} = props.req;
    const resp_hs = JSON.parse(response_headers);
    const req_hs = JSON.parse(request_headers);
    const general_entries = [['Request URL', url],
        ['Status Code', status_code]];
    const width = 'calc(100% - 250px)';
    return (
        <div className="preview" style={{minWidth: width, maxWidth: width}}>
          <Preview_section title="General" entries={general_entries}/>
          <Preview_section title="Response headers"
            entries={Object.entries(resp_hs)}/>
          <Preview_section title="Request headers"
            entries={Object.entries(req_hs)}/>
        </div>
    );
};

const Preview_section = props=>(
    <div className="section">
      <div className="title">{props.title}</div>
      {(props.entries||[]).map(pair=>
        <Key_value key={pair[0]} k={pair[0]} val={pair[1]}/>
      )}
    </div>
);

const Key_value = ({k, val})=>(
    <div className="key_value">
      <div className="key">{k}</div>
      <div className="value">{val}</div>
    </div>
);

export default {StatsDetails, StatTable, StatsService};
