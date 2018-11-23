// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from '../../../util/ajax.js';
import {withContext} from 'recompose';
import {with_resizable_cols} from '../chrome_widgets.js';
import Pure_component from '../../../www/util/pub/pure_component.js';
import moment from 'moment';
import {withRouter} from 'react-router-dom';
import Har_viewer from '../har_viewer.js';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

moment.relativeTimeThreshold('ss', 3);

export default provider({tab_id: 'debug'})(props=>
  <Har_viewer/>
);

const Details_tables = ()=>
  <div className="details_tables">
    <Fast_pool/>
    <Banned_ips/>
  </div>;

const Fast_pool = ()=>
    <div className="chrome details_table">
      <div className="main_panel vbox">
        <div className="toolbar_container">
          <div className="toolbar">
            <div className="title_wrapper">
              Sessions
            </div>
          </div>
        </div>
        <Fast_pool_table/>
      </div>
    </div>;

const Banned_ips = ()=>
    <div className="chrome details_table">
      <div className="main_panel vbox">
        <div className="toolbar_container">
          <div className="toolbar">
            <div className="title_wrapper">
              Banned IPs
            </div>
          </div>
        </div>
        <Banned_ips_table/>
      </div>
    </div>;

const Banned_ips_table = withRouter(
    with_resizable_cols([{id: 'ip', title: 'IP'}, {id: 'ms', title: 'Expire'}],
class Banned_ips_table extends Pure_component {
    state = {};
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/banlist/${port}?full=true`;
            const data = yield ajax.json({url});
            _this.setState({data: data.ips||[]});
        });
    }
    render(){
        const {cols} = this.props;
        return <div className="tables_container vbox">
              <Header_container cols={cols}/>
              <Ban_data_container cols={cols} data={this.state.data}/>
            </div>;
    }
}));

const Fast_pool_table = withRouter(
    with_resizable_cols([{id: 'ip', title: 'Last IP'},
    {id: 'session', title: 'Session'}, {id: 'host', title: 'Host'}],
class Fast_pool_table extends Pure_component {
    state = {};
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/sessions/${port}`;
            const data = yield ajax.json({url});
            _this.setState({data: data.sessions||[]});
        });
    }
    render(){
        const {cols} = this.props;
        return <div className="tables_container vbox">
              <Header_container cols={cols}/>
              <Fast_pool_data_container cols={cols} data={this.state.data}/>
            </div>;
    }
}));

const Header_container = ({cols})=>
    <div className="header_container">
      <table>
        <colgroup>
          {(cols||[]).map((c, idx)=><col key={idx} style={{width: c.width}}/>)}
        </colgroup>
        <tbody>
          <tr>
            {(cols||[]).map((c, idx)=><th key={idx}>{c.title}</th>)}
          </tr>
        </tbody>
      </table>
    </div>;

const Ban_data_container = ({cols, data})=>{
    if (!data)
        return null;
    return <div className="data_container">
          <table>
            <colgroup>
              {(cols||[]).map((c, idx)=>
                <col key={idx} style={{width: c.width}}/>
              )}
            </colgroup>
            <tbody>
              {data.map(d=>
                <tr key={d.ip}>
                  <td>{d.ip}</td>
                  <td>{d.to ? moment(d.to).fromNow() : ' - '}</td>
                </tr>
              )}
              <tr className="filler">
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>;
};

const Fast_pool_data_container = ({cols=[], data})=>{
    if (!data)
        return null;
    return <div className="data_container">
          <table>
            <colgroup>
              {cols.map((c, idx)=>
                <col key={idx} style={{width: c.width}}/>
              )}
            </colgroup>
            <tbody>
              {data.map(d=>
                <tr key={d.session}>
                  <td>{d.ip ? d.ip : ' - '}</td>
                  <td>{d.session}</td>
                  <td>{d.host}</td>
                </tr>
              )}
              <tr className="filler">
                {cols.map(c=><td key={c.id}></td>)}
              </tr>
            </tbody>
          </table>
        </div>;
};
