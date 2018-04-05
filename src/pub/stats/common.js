// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import _ from 'lodash';
import React from 'react';
import ajax from 'hutil/util/ajax';
import zescape from 'hutil/util/escape';
import etask from 'hutil/util/etask';
import util from '../util.js';
import classnames from 'classnames';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import {Tooltip} from './../common.js';
import $ from 'jquery';

const Empty_row = ()=>(
    <tr className="empty_row">
      <td>—</td><td>—</td><td>—</td><td>—</td>
    </tr>
);

class Row extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillMount(){
        this.setdb_on('head.callbacks.state.go', go=>this.setState({go})); }
    click(){
        this.state.go('logs',
            {[this.props.logs]: this.props.stat[this.props.row_key]});
    }
    render(){
        const {stat, row_key} = this.props;
        return (
            <tr onClick={this.click.bind(this)}>
              <td>{stat[row_key]}</td>
              <td>{util.bytes_format(stat.out_bw)}</td>
              <td>{util.bytes_format(stat.in_bw)}</td>
              <td className="reqs">{stat.value}</td>
            </tr>
        );
    }
}

const Stat_table = props=>{
    return (
        <div className="stat_table_wrapper">
          <div className="stat_table">
            {props.show_more && <small><a href="/logs">show all</a></small>}
            <table className="table table-condensed table-hover">
              <thead>
                <tr>
                  <th className="col val">{props.title}</th>
                  <th className="col bw">BW up</th>
                  <th className="col bw">BW down</th>
                  <th className="col reqs">
                    <Tooltip title="Number of requests">
                      <span>Requests</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                <If when={!props.stats||!props.stats.length}>
                  <Empty_row/>
                </If>
                {(props.stats||[]).map(s=>
                  <Row stat={s} key={s[props.row_key]} row_key={props.row_key}
                    logs={props.logs}
                    {...(props.row_opts||{})}/>)}
              </tbody>
            </table>
          </div>
        </div>
    );
};

class StatsService {
    static base = '/api/request_stats';
    static get_top = etask._fn(function*(_this, opt={}){
        const res = yield _this.get('top', opt.master_port);
        const assign = Object.assign;
        opt = assign({reverse: true}, opt);
        let state = _.reduce(res, (s, v, k)=>{
            if (_.isInteger(+k))
                return s.statuses.stats.push(assign({status_code: k,
                    value: v.count, in_bw: v.in_bw, out_bw: v.out_bw}, v))&&s;
            if (['http', 'https'].includes(k))
            {
                return s.protocols.stats.push(assign({protocol: k,
                    in_bw: v.in_bw, out_bw: v.out_bw, value: v.count}, v))&&s;
            }
            return s.domains.stats.push(assign({hostname: k, value: v.count,
                in_bw: v.inbw, out_bw: v.out_bw}, v)) && s;
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
    static reset = etask._fn(function*(_this){
        let resps = yield etask.all([
            _this.get('reset'),
            ajax({url: '/api/proxy_stats/reset'}),
            ajax({url: '/api/req_status/reset'}),
        ]);
        return resps[0];
    });
    static get = etask._fn(function*(_, stats, master_port){
        const url = zescape.uri(`${StatsService.base}/${stats}`,
            {master_port});
        let res = yield ajax.json({url});
        return res[stats];
    });
}

export default {Stat_table, StatsService};
