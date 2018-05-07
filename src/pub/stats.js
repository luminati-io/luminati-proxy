// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import util from './util.js';
import etask from 'hutil/util/etask';
import date from 'hutil/util/date';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import {Modal_dialog, Tooltip, Modal} from './common.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';
import {withRouter} from 'react-router-dom';

class Success_ratio extends Pure_component {
    render (){
        const total = this.props.total||0;
        const success = this.props.success||0;
        const ratio = total==0 ? NaN : success/total*100;
        const tooltip = `Ratio of successful requests out of total
            requests, where successful requests are calculated as 2xx,
            3xx or 404 HTTP status codes`;
        const val_tooltip = `total: ${total}, success: ${success}`;
        return (
            <div className="overall_success_ratio">
              <div className="success_title">
                <Tooltip title={tooltip}>Success rate:</Tooltip>
              </div>
              <div className="success_value">
                <Tooltip title={val_tooltip}>
                  {isNaN(ratio) ? '-' : ratio.toFixed(2)+'%'}
                </Tooltip>
              </div>
            </div>
        );
    }
}

class Stats extends Pure_component {
    state = {
        statuses: {stats: []},
        domains: {stats: []},
        protocols: {stats: []},
        stats: {},
    };
    componentWillMount(){
        this.setdb_on('head.recent_stats', stats=>{
            if (stats)
                this.setState({stats});
        });
    }
    enable_ssl_click(e){
        e.stopPropagation();
        $('#enable_ssl_modal').modal();
    }
    enable_ssl(){
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            yield ajax({url: '/api/enable_ssl', method: 'POST'});
        });
    }
    close_reset_dialog = ()=>this.setState({show_reset: false});
    show_reset_dialog = ()=>this.setState({show_reset: true});
    reset_stats = ()=>{
        util.ga_event('stats panel', 'click', 'reset btn');
        const _this = this;
        this.etask(function*(){
            yield ajax({url: '/api/recent_stats/reset'});
            _this.close_reset_dialog();
        });
    };
    render(){
        return (
            <div className="panel stats_panel">
              <div className="panel_heading">
                <h2>Statistics</h2>
                <div className="buttons_wrapper">
                  <button className="btn btn_lpm btn_lpm_normal btn_lpm_small"
                    onClick={this.show_reset_dialog}>Reset</button>
                </div>
              </div>
              <div className="panel_body with_table">
                <Success_ratio total={this.state.stats.total}
                  success={this.state.stats.success}/>
                <Stat_table stats={this.state.stats}
                  row_key="status_code" logs="code" title="Code"/>
                <Stat_table stats={this.state.stats}
                  row_key="hostname" logs="domain" title="Domain"/>
                <Protocol_table stats={this.state.stats}
                  enable_ssl_click={this.enable_ssl_click.bind(this)}/>
                <Modal_dialog open={this.state.show_reset}
                  title="Are you sure you want to reset stats?"
                  ok_clicked={this.reset_stats}
                  cancel_clicked={this.close_reset_dialog}/>
                <Enable_ssl_modal enable_ssl={this.enable_ssl.bind(this)}/>
              </div>
            </div>
        );
    }
}

const Enable_ssl_modal = ({enable_ssl})=>(
    <Modal id="enable_ssl_modal" title="Enable SSL analyzing for all proxies"
      click_ok={enable_ssl}/>
);

const Protocol_table = ({stats, enable_ssl_click})=>{
    return (
        <Stat_table stats={stats} row_key="protocol" logs="protocol"
          title="Protocol" enable_ssl_click={enable_ssl_click}/>
    );
};

const Empty_row = ()=>(
    <tr className="empty_row">
      <td>—</td><td>—</td><td>—</td><td>—</td>
    </tr>
);

const Row = withRouter(class Row extends Pure_component {
    click = ()=>{
        const url = `/logs?${this.props.logs}=${this.props.stat.key}`;
        this.props.history.push(url);
    };
    render(){
        const {stat, row_key} = this.props;
        return (
            <tr onClick={this.click}>
              <Key_cell title={stat.key} enable={stat.enable}
                warning={stat.warning}
                enable_click={this.props.enable_ssl_click}/>
              <td>{util.bytes_format(stat.out_bw)||'—'}</td>
              <td>{util.bytes_format(stat.in_bw)||'—'}</td>
              <td className="reqs">{stat.reqs||'—'}</td>
            </tr>
        );
    }
});

const Key_cell = ({title, enable, warning, enable_click})=>{
    const warning_tooltip = `Some of your ports don't have SSL analyzing
        enabled and there are connections on HTTPS protocol detected`;
    return (
        <td>
          {title}
          <If when={warning}>
            <Tooltip title={warning_tooltip}>
              <div className="ic_warning"/>
            </Tooltip>
          </If>
          <If when={enable}>
            <a className="link enable_ssl" onClick={enable_click}>enable</a>
          </If>
        </td>
    );
};

const Stat_table = ({title, stats, row_key, logs, enable_ssl_click})=>
{
    const show_more = stats[row_key]&&stats[row_key].length > 5;
    stats = stats[row_key]&&stats[row_key].slice(0, 5)||[];
    return (
        <div className="stat_table_wrapper">
          <div className="stat_table">
            {show_more && <small><a href="/logs">show all</a></small>}
            <table className="table table-condensed table-hover">
              <thead>
                <tr>
                  <th className="col val">{title}</th>
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
                <If when={!stats.length}><Empty_row/></If>
                {stats.map(s=>(
                  <Row stat={s} key={s.key} row_key={row_key} logs={logs}
                    enable_ssl_click={enable_ssl_click}/>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    );
};

export default Stats;
