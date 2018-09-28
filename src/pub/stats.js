// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {ga_event, status_codes} from './util.js';
import ajax from '../../util/ajax.js';
import {Tooltip_bytes} from './common.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import $ from 'jquery';
import {withRouter} from 'react-router-dom';
import {Tooltip, Toolbar_button, Devider, Sort_icon,
    with_resizable_cols} from './chrome_widgets.js';

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
    enable_ssl_click = e=>{
        e.stopPropagation();
        $('#enable_ssl_modal').modal();
    };
    show_reset_dialog = ()=>this.setState({show_reset: true});
    render(){
        return <div className="chrome stats_panel">
              <div className="main_panel">
                <Toolbar stats={this.state.stats}/>
                <Stat_table stats={this.state.stats} tooltip="Status code"
                  row_key="status_code" logs="code" title="Code"/>
                <Stat_table stats={this.state.stats} tooltip="Domain name"
                  row_key="hostname" logs="domain" title="Domain"/>
                <Stat_table stats={this.state.stats} tooltip="Protocol"
                  ssl_warning={this.state.stats.ssl_warning}
                  row_key="protocol" logs="protocol" title="Protocol"/>
                <Summary_bar enable_ssl_click={this.enable_ssl_click}
                  show={this.state.stats.ssl_enable}/>
              </div>
            </div>;
    }
}

const Empty_row = ()=>
    <tr className="empty_row">
      <td>—</td><td>—</td><td>—</td><td>—</td>
    </tr>;

const Row = withRouter(class Row extends Pure_component {
    click = ()=>{
        const url = `/logs?${this.props.logs}=${this.props.stat.key}`;
        this.props.history.push(url);
    };
    render(){
        const {stat, row_key, warning} = this.props;
        return <tr onClick={this.click}>
              <Key_cell row_key={row_key} title={stat.key} warning={warning}/>
              <td><Tooltip_bytes chrome_style bytes={stat.out_bw}/></td>
              <td><Tooltip_bytes chrome_style bytes={stat.in_bw}/></td>
              <td><Cell>{stat.reqs||'—'}</Cell></td>
            </tr>;
    }
});

const Key_cell = ({title, warning, row_key})=>{
    const warning_tooltip = `Some of your proxy ports don't have SSL analyzing
        enabled and there are connections on HTTPS protocol detected`;
    return <td>
          <Cell row_key={row_key}>{title}</Cell>
          {warning &&
            <Tooltip title={warning_tooltip}>
              <div className="ic_warning"/>
            </Tooltip>
          }
        </td>;
};

const Cell = ({row_key, children})=>{
    if (row_key=='status_code')
    {
        return <Tooltip title={children+' '+status_codes[children]}>
              <div className="disp_value">{children}</div>
            </Tooltip>;
    }
    return <Tooltip title={children}>
          <div className="disp_value">{children}</div>
        </Tooltip>;
};

const Stat_table = with_resizable_cols([{id: 'key'}, {id: 'out_bw'},
    {id: 'in_bw'}, {id: 'reqs'}],
class Stat_table extends Pure_component {
    state = {sorting: {col: 0, dir: 1}};
    sort = col=>{
        const cur_sorting = this.state.sorting;
        const dir = cur_sorting.col==col ? -1*cur_sorting.dir : 1;
        this.setState({sorting: {dir, col}});
    };
    render(){
        const {title, stats, row_key, logs, ssl_warning, cols} = this.props;
        const cur_stats = stats[row_key]||[];
        return <div className="tables_container vbox">
              <Header_container title={title} cols={cols}
                tooltip={this.props.tooltip}
                sorting={this.state.sorting} sort={this.sort}/>
              <Data_container stats={cur_stats} row_key={row_key} logs={logs}
                ssl_warning={ssl_warning} cols={cols}
                sorting={this.state.sorting}/>
            </div>;
    }
});

const Header_container = ({title, cols, sorting, sort, tooltip})=>
    <div className="header_container">
      <table>
        <colgroup>
          {(cols||[]).map((c, idx)=><col key={idx} style={{width: c.width}}/>)}
        </colgroup>
        <tbody>
          <tr>
            <Header sort={sort} id={0} label={title} sorting={sorting}
              tooltip={tooltip}/>
            <Header sort={sort} id={1} label="BW up" sorting={sorting}
              tooltip="Outgoing bandwidth"/>
            <Header sort={sort} id={2} label="BW down" sorting={sorting}
              tooltip="Incoming bandwidth"/>
            <Header sort={sort} id={3} label="Requests" sorting={sorting}
              tooltip="Number of sent requests"/>
          </tr>
        </tbody>
      </table>
    </div>;

const Header = ({sort, sorting, id, label, tooltip})=>
    <Tooltip title={tooltip}>
      <th onClick={()=>sort(id)}>
        <div>{label}</div>
        <Sort_icon show={sorting.col==id} dir={sorting.dir}/>
      </th>
    </Tooltip>;

const Data_container = ({stats, row_key, logs, ssl_warning, cols, sorting})=>{
    if (!cols)
        return null;
    const sorted = stats.slice().sort((a, b)=>{
        const field = cols[sorting.col].id;
        const val_a = a[field];
        const val_b = b[field];
        let res = val_a>val_b;
        return sorting.dir==-1 ? res : !res;
    });
    return <div className="data_container">
          <table>
            <colgroup>
              {(cols||[]).map((c, idx)=>
                <col key={idx} style={{width: c.width}}/>
              )}
            </colgroup>
            <tbody>
              {!sorted.length && <Empty_row/>}
              {sorted.map(s=>
                <Row stat={s} key={s.key} row_key={row_key} logs={logs}
                  warning={ssl_warning&&s.key=='https'}/>
              )}
              <tr className="filler">
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>;
};

const Summary_bar = ({enable_ssl_click, show})=>{
    if (!show)
        return null;
    const tooltip = `Enable HTTPS analyzing for all your proxies. You will also
        need to install SSL certificate. It allows you to use rules and logs
        for HTTPS requests`;
    return <div className="summary_bar">
          <a className="link enable_https" onClick={enable_ssl_click}>
            <Tooltip title={tooltip}>
              Enable HTTPS request logging and debugging
            </Tooltip>
          </a>
        </div>;
};

class Toolbar extends Pure_component {
    clear = ()=>{
        ga_event('stats panel', 'click', 'reset btn');
        this.etask(function*(){
            yield ajax({url: '/api/recent_stats/reset'});
        });
    };
    render(){
        return <div className="toolbar_container">
              <div className="toolbar">
                <Toolbar_button id="clear" tooltip="Clear"
                  on_click={this.clear}/>
                <Devider/>
                <Success_ratio total={this.props.stats.total}
                  success={this.props.stats.success}/>
              </div>
            </div>;
    }
}

const Success_ratio = ({total=0, success=0})=>{
    const ratio = total==0 ? NaN : success/total*100;
    const tooltip = `Ratio of successful requests out of total
        requests, where successful requests are calculated as 2xx,
        3xx or 404 HTTP status codes`;
    const val_tooltip = `total: ${total}, success: ${success}`;
    return <div className="overall_success_ratio">
          <div className="success_title">
            <Tooltip title={tooltip}>Success rate:</Tooltip>
          </div>
          <div className="success_value">
            <Tooltip title={val_tooltip}>
              {isNaN(ratio) ? '-' : ratio.toFixed(2)+'%'}
            </Tooltip>
          </div>
        </div>;
};

export default Stats;
