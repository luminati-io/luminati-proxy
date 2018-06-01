// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {ga_event, bytes_format} from './util.js';
import etask from 'hutil/util/etask';
import date from 'hutil/util/date';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import {Modal, Circle_li as Li, Tooltip_bytes} from './common.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';
import {withRouter} from 'react-router-dom';
import classnames from 'classnames';
import {Tooltip, Toolbar_button, Devider, Sort_icon,
    with_resizable_cols} from './chrome_widgets.js';
import {status_codes} from './util.js';

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
    enable_ssl = ()=>{
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            yield ajax({url: '/api/enable_ssl', method: 'POST'});
        });
    };
    show_reset_dialog = ()=>this.setState({show_reset: true});
    render(){
        return [
            <div key="1" className="chrome stats_panel">
              <div className="main_panel">
                <Toolbar stats={this.state.stats}/>
                <Stat_table stats={this.state.stats}
                  row_key="status_code" logs="code" title="Code"/>
                <Stat_table stats={this.state.stats}
                  row_key="hostname" logs="domain" title="Domain"/>
                <Stat_table stats={this.state.stats}
                  ssl_warning={this.state.stats.ssl_warning}
                  row_key="protocol" logs="protocol" title="Protocol"/>
                <Summary_bar enable_ssl_click={this.enable_ssl_click}
                  show={this.state.stats.ssl_enable}/>
              </div>
            </div>,
            <Enable_ssl_modal key="2" enable_ssl={this.enable_ssl}/>,
        ];
    }
}

const faq_cert_url = 'https://luminati.io/faq#proxy-certificate';
const Enable_ssl_modal = ({enable_ssl})=>(
    <Modal id="enable_ssl_modal" title="Enable SSL analyzing for all proxies"
      click_ok={enable_ssl} className="enable_ssl_modal">
      <p className="cert_info">
        You will also need to add a certificate file to browsers.
        Gathering stats for HTTPS requests requires setting a certificate key.
      </p>
      <div className="instructions">
        <ol>
          <Li>Download our free certificate key
            <a href="/ssl" target="_blank" download> here</a>
          </Li>
          <Li>
            Add the certificate to your browser. You can find more detailed
            instructions <a className="link" href={faq_cert_url}
              rel="noopener noreferrer" target="_blank">here</a>
          </Li>
          <Li>Refresh the page</Li>
        </ol>
      </div>
    </Modal>
);

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
        const {stat, row_key, warning} = this.props;
        return (
            <tr onClick={this.click}>
              <Key_cell row_key={row_key} title={stat.key} warning={warning}/>
              <td><Tooltip_bytes chrome_style bytes={stat.out_bw}/></td>
              <td><Tooltip_bytes chrome_style bytes={stat.in_bw}/></td>
              <td><Cell>{stat.reqs||'—'}</Cell></td>
            </tr>
        );
    }
});

const Key_cell = ({title, warning, row_key})=>{
    const warning_tooltip = `Some of your proxy ports don't have SSL analyzing
        enabled and there are connections on HTTPS protocol detected`;
    return (
        <td>
          <Cell row_key={row_key}>{title}</Cell>
          <If when={warning}>
            <Tooltip title={warning_tooltip}>
              <div className="ic_warning"/>
            </Tooltip>
          </If>
        </td>
    );
};

const Cell = ({row_key, title, children})=>{
    if (row_key=='status_code')
    {
        return (
            <Tooltip title={title+' '+status_codes[title]}>
              <div className="disp_value">{children}</div>
            </Tooltip>
        );
    }
    else
    {
        return (
            <Tooltip title={title||children}>
              <div className="disp_value">{children}</div>
            </Tooltip>
        );
    }
};

const Stat_table = with_resizable_cols([{id: 'key'}, {id: 'out_bw'},
    {id: 'in_bw'}, {id: 'reqs'}],
class Stat_table extends Pure_component {
    state = {sorting: {col: 0, dir: 1}};
    sort = col=>{
        const cur_sorting = this.state.sorting;
        const dir = cur_sorting.col==col ?  -1*cur_sorting.dir : 1;
        this.setState({sorting: {dir, col}});
    };
    render(){
        const {title, stats, row_key, logs, ssl_warning, cols} = this.props;
        const cur_stats = stats[row_key]||[];
        return (
            <div className="tables_container vbox">
              <Header_container title={title} cols={cols}
                sorting={this.state.sorting} sort={this.sort}/>
              <Data_container stats={cur_stats} row_key={row_key} logs={logs}
                ssl_warning={ssl_warning} cols={cols}
                sorting={this.state.sorting}/>
            </div>
        );
    }
});

const Header_container = ({title, cols, sorting, sort})=>(
    <div className="header_container">
      <table>
        <colgroup>
          {(cols||[]).map((c, idx)=>(
            <col key={idx} style={{width: c.width}}/>
          ))}
        </colgroup>
        <tbody>
          <tr>
            <Header sort={sort} id={0} label={title} sorting={sorting}/>
            <Header sort={sort} id={1} label="BW up" sorting={sorting}/>
            <Header sort={sort} id={2} label="BW down" sorting={sorting}/>
            <Header sort={sort} id={3} label="Requests" sorting={sorting}/>
          </tr>
        </tbody>
      </table>
    </div>
);

const Header = ({sort, sorting, id, label})=>(
    <th onClick={()=>sort(id)}>
      <div>{label}</div>
      <Sort_icon show={sorting.col==id} dir={sorting.dir}/>
    </th>
);

const Data_container = ({stats, row_key, logs, ssl_warning, cols, sorting})=>{
    const sorted = stats.slice().sort((a, b)=>{
        const field = cols[sorting.col].id;
        const val_a = a[field];
        const val_b = b[field];
        let res = val_a>val_b;
        return sorting.dir==-1 ? res : !res;
    });
    return (
        <div className="data_container">
          <table>
            <colgroup>
              {(cols||[]).map((c, idx)=>(
                <col key={idx} style={{width: c.width}}/>
              ))}
            </colgroup>
            <tbody>
              <If when={!sorted.length}><Empty_row/></If>
              {sorted.map(s=>(
                <Row stat={s} key={s.key} row_key={row_key} logs={logs}
                  warning={ssl_warning&&s.key=='https'}/>
              ))}
              <tr className="filler">
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
    );
};

const Summary_bar = ({enable_ssl_click, show})=>{
    if (!show)
        return null;
    const tooltip = `Enable HTTPS analyzing for all your proxies. You will also
        need to install SSL certificate. It allows you to use rules and logs
        for HTTPS requests`;
    return (
        <div className="summary_bar">
          <a className="link enable_https" onClick={enable_ssl_click}>
            <Tooltip title={tooltip}>
              Enable HTTPS request logging and debugging
            </Tooltip>
          </a>
        </div>
    );
};

class Toolbar extends Pure_component {
    clear = ()=>{
        ga_event('stats panel', 'click', 'reset btn');
        const _this = this;
        this.etask(function*(){
            yield ajax({url: '/api/recent_stats/reset'});
        });
    };
    render(){
        return (
            <div className="toolbar_container">
              <div className="toolbar">
                <Toolbar_button id="clear" tooltip="Clear"
                  on_click={this.clear}/>
                <Devider/>
                <Success_ratio total={this.props.stats.total}
                  success={this.props.stats.success}/>
              </div>
            </div>
        );
    }
}

const Success_ratio = ({total=0, success=0})=>{
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
};

export default Stats;
