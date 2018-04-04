// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import moment from 'moment';
import React from 'react';
import {Col, Table, Pagination} from 'react-bootstrap';
import axios from 'axios';
import etask from 'hutil/util/etask';
import zurl from 'hutil/util/url';
import util from '../util.js';
import classnames from 'classnames';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';

const Empty_row = ()=>(
    <tr className="empty_row">
      <td>—</td><td>—</td><td>—</td><td>—</td>
    </tr>
);

const Stat_table = props=>{
    const Row = props.row;
    return (
        <div className="stat_table_wrapper">
          <div className="stat_table">
            {props.show_more && <small><a href="/logs">show all</a></small>}
            <Table hover condensed>
              <thead>{props.children}</thead>
              <tbody>
                <If when={!props.stats.length}>
                  <Empty_row/>
                </If>
                {props.stats.map(s=>
                  <Row stat={s} key={s[props.row_key||'key']}
                    path={props.path} {...(props.row_opts||{})}/>)}
              </tbody>
            </Table>
          </div>
        </div>
    );
};

class StatsService {
    static base = '/api/request_stats';
    static get_top = etask._fn(function*(_this, opt = {}){
        const res = yield _this.get('top'), assign = Object.assign;
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
    static get_all = etask._fn(function*(_this, opt = {}){
        opt = Object.assign({reverse: 1}, opt);
        let res = yield _this.get('all');
        if (opt.by)
        {
            res = _(Object.values(res.reduce((s, v, k)=>{
                let c = v[opt.by];
                s[c] = s[c]||Object.assign({value: 0, in_bw: 0, out_bw: 0}, v);
                s[c].value += 1;
                s[c].in_bw += v.in_bw;
                s[c].out_bw += v.out_bw;
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
            axios.get(`/api/req_status/reset`),
        ]);
        return resps[0];
    });
    static get = etask._fn(function*(_, stats){
        let res = yield etask(()=>axios.get(`${StatsService.base}/${stats}`));
        return res.data[stats];
    });
}

export default {Stat_table, StatsService};
