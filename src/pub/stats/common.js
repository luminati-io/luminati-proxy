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
        if (!state.protocols.stats.some(_.matches({protocol: 'https'})))
            state.protocols.stats.push({protocol: 'https', bw: 0, value: 0});
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
    select_item(preview_req){ this.setState({preview_req}); }
    paginate(page = -1){
        page = page > -1 ? page : this.state.cur_page;
        let stats = this.state.all_stats;
        let cur_page = _.min(
            [Math.ceil(stats.length/this.state.items_per_page), page]);
        this.setState({
            stats: stats.slice(cur_page*this.state.items_per_page,
                (cur_page+1)*this.state.items_per_page),
            cur_page,
            preview_req: stats[0]||{},
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
                    <div className="list_wrapper">
                      <div className="title">URL</div>
                      <div className="list">
                        {this.state.stats.map((s, i)=>
                          <Request_item key={i} req={s}
                            select_item={this.select_item.bind(this)}
                            active={this.state.preview_req.id==s.id}/>
                        )}
                      </div>
                      {pagination}
                    </div>
                    <Preview_req req={this.state.preview_req}/>
                  </div>
                </div>
                {this.props.children}
              </div>
            </div>;
    }
}

const Request_item = props=>{
    return (
        <div onClick={()=>props.select_item(props.req)}
          className={classnames('request_item', {active: props.active})}>
          {props.req.url}
        </div>
    );
};

const Preview_req = props=>{
    if (!props.req||!props.req.status_code)
        return null;
    const {response_headers, request_headers, status_code, url,
        id} = props.req;
    const resp_hs = JSON.parse(response_headers);
    const req_hs = JSON.parse(request_headers);
    return (
        <div className="preview">
          <div className="section">
            <div className="title">General</div>
            <Key_value k="Request URL" val={url}/>
            <Key_value k="Status Code" val={status_code}/>
          </div>
          <div className="section">
            <div className="title">Response headers</div>
            {Object.entries(resp_hs).map(pair=>
              <Key_value key={pair[0]} k={pair[0]} val={pair[1]}/>
            )}
          </div>
          <div className="section">
            <div className="title">Request headers</div>
            {Object.entries(req_hs).map(pair=>
              <Key_value key={pair[0]} k={pair[0]} val={pair[1]}/>
            )}
          </div>
        </div>
    );
};

const Key_value = ({k, val})=>(
    <div className="key_value">
      <div className="key">{k}</div>
      <div className="value">{val}</div>
    </div>
);

export default {StatsDetails, StatTable, StatsService};
