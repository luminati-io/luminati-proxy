// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import {ga_event, status_codes} from './util.js';
import ajax from '../../util/ajax.js';
import {Tooltip_bytes, Loader_small} from './common.js';
import Tooltip from './common/tooltip.js';
import Pure_component from '/www/util/pub/pure_component.js';
import setdb from '../../util/setdb.js';
import {Toolbar_button, Devider, Sort_icon,
    with_resizable_cols, Toolbar_container,
    Toolbar_row} from './chrome_widgets.js';
import {T} from './common/i18n.js';

class Stats extends Pure_component {
    state = {stats: {}, toggling: false};
    componentDidMount(){
        this.setdb_on('head.recent_stats', stats=>{
            if (stats)
                this.setState({stats});
        });
        this.setdb_on('head.settings', s=>{
            if (s)
                this.setState({request_stats: s.request_stats});
        });
        this.setdb_on('head.save_settings', save_settings=>{
            this.save_settings = save_settings;
            if (typeof this.saved_stats=='boolean')
            {
                this.toggle_stats(this.saved_stats);
                delete this.saved_stats;
            }
        });
    }
    toggle_stats = val=>{
        if (!this.save_settings)
        {
            this.saved_stats = val;
            return;
        }
        const _this = this;
        this.setState({toggling: true});
        this.etask(function*(){
            this.on('finally', ()=>_this.setState({toggling: false}));
            const settings = Object.assign({}, setdb.get('head.settings'));
            settings.request_stats = val;
            yield _this.save_settings(settings);
        });
    };
    render(){
        const {toggling, request_stats, stats} = this.state;
        if (request_stats!==undefined && !request_stats)
        {
            return <Stats_off_btn turn_on_stats={()=>this.toggle_stats(true)}
              disabled={toggling}/>;
        }
        return <div className="stats_wrapper">
              <div className="chrome stats_panel">
                <div className="main_panel">
                  {!request_stats &&
                    <Loader_small show loading_msg="Loading..."/>
                  }
                  {request_stats && <React.Fragment>
                    <Toolbar stats={stats}
                      disable_stats={()=>this.toggle_stats(false)}/>
                    <Stat_table stats={stats} tooltip="Status code"
                      style={{flex: 1, overflowY: 'auto'}}
                      row_key="status_code" logs="code" title="Code"/>
                    <Stat_table stats={stats} tooltip="Domain name"
                      style={{flex: 1, overflowY: 'auto'}}
                      row_key="hostname" logs="domain" title="Domain"/>
                    <Stat_table stats={stats} tooltip="Protocol"
                      style={{flex: 1, overflowY: 'auto'}}
                      ssl_warning={stats.ssl_warning} row_key="protocol"
                      logs="protocol" title="Protocol"/>
                  </React.Fragment>}
                </div>
              </div>
            </div>;
    }
}

const Stats_off_btn = props=>
  <Tooltip title="Recent stats are disabled. Click here to turn it on again"
    placement="left">
    <button className="enable_btn enable_btn_stats" disabled={props.disabled}
      onClick={props.turn_on_stats}>
      <i className="glyphicon glyphicon-chevron-left"/>
    </button>
  </Tooltip>;

const Empty_row = ()=>
    <tr className="empty_row">
      <td>—</td><td>—</td><td>—</td><td>—</td>
    </tr>;

const Key_cell = ({title, warning, row_key})=>{
    const warning_tooltip = 'Some of your proxy ports don\'t have SSL '
    +'analyzing enabled and there are connections on HTTPS protocol detected';
    return <td>
          <Cell row_key={row_key}>{title}</Cell>
          {warning && <T>{t=>
            <Tooltip title={t(warning_tooltip)}>
              <div className="ic_warning"/>
            </Tooltip>
          }</T>}
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
    <T>{t=>
      <Tooltip title={t(tooltip)}>
        <th onClick={()=>sort(id)}>
          <div>{t(label)}</div>
          <Sort_icon show={sorting.col==id} dir={sorting.dir}/>
        </th>
      </Tooltip>
    }</T>;

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

class Toolbar extends Pure_component {
    clear = ()=>{
        ga_event('stats panel', 'click', 'reset btn');
        this.etask(function*(){
            yield ajax({url: '/api/logs_reset'});
            setdb.emit_path('head.har_viewer.reset_reqs');
        });
    };
    render(){
        return <Toolbar_container>
              <Toolbar_row>
                <Toolbar_button id="clear" tooltip="Clear"
                  on_click={this.clear}/>
                <Devider/>
                <Success_ratio total={this.props.stats.total}
                  success={this.props.stats.success}/>
                <Toolbar_button id="close_btn" tooltip="Disable"
                  placement="left" on_click={this.props.disable_stats}/>
              </Toolbar_row>
            </Toolbar_container>;
    }
}

const Success_ratio = ({total=0, success=0})=>{
    const ratio = total==0 ? NaN : success/total*100;
    const tooltip = 'Ratio of successful requests out of total '
    +'requests, where successful requests are calculated as 2xx, '
    +'3xx or 404 HTTP status codes';
    return <div className="title_wrapper">
          <div className="success_title">
            <T>{t=>
              <Tooltip title={t(tooltip)}>
                <span>{t('Success rate')}:</span>
              </Tooltip>
            }</T>
          </div>
          <div className="success_value">
            <T>{t=>
              <Tooltip
                title={`${t('Total')}: ${total}, ${t('Success')}: ${success}`}>
                {isNaN(ratio) ? '-' : ratio.toFixed(2)+'%'}
              </Tooltip>
            }</T>
          </div>
        </div>;
};

export default Stats;
