// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {withRouter} from 'react-router-dom';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import styled from 'styled-components';
import {Button, Tooltip, IconButton, Input, Icon} from 'uikit';
import {Inline_wrapper, Vertical_divider} from './common.js';
import {T} from './common/i18n.js';
import ws from './ws.js';
import './css/overview.less';

const Search_input = styled(Input.Textbox)`
    width: 160px;
    border: none;
    padding: 0 0 0 3px;
    border-radius: 0;
    color: rgb(48, 57, 66);
    font-family: Roboto, Ubuntu, Arial, sans-serif;
    font-weight: normal;
`;

const Nav_divider = ()=>
  <Vertical_divider
    height="34px"
    margin_left="2px"
    margin_right="2px"
  />;

const Search_box = props=>{
  if (!props.show)
      return null;
  return <Search_input
    leftInnerContent={<Icon color="gray_9" name="Search" size="xs"/>}
    value={props.value}
    onChange={props.on_change}
    placeholder={props.placeholder}
  />;
};

const Add_proxy_btn = ()=>{
  const open_modal = ()=>{
      ws.post_event('Add New Port Click');
      return $('#add_new_proxy_modal').modal('show');
  };
  return <T>{t=>
    <Tooltip tooltip={t('New port')}>
      <Button
        icon="Add"
        onClick={open_modal}
        size="sm"
        text={t('New port')}
      />
    </Tooltip>
  }</T>;
};

const Nav_icon = withRouter(props=>{
  const navigate_to = path=>{
      if (props.on_click)
          props.on_click();
      props.history.push({pathname: path});
  };
  const on_click_navigate = {onClick: ()=>navigate_to(props.link_to)};
  return <T>{t=>
    <IconButton
      icon={props.icon}
      active={!!props.filled}
      onClick={props.on_click}
      {...(props.link_to && on_click_navigate)}
      tooltip={t(props.tooltip)}
      disabled={props.disabled}
    />
  }</T>;
});

class Toolbar extends Pure_component {
    constructor(props){
        super(props);
        this.state = {show_filters: false};
    }
    toggle_filters = ()=>{
        if (!this.state.show_filters)
            ws.post_event('Toolbar Filters Clicked');
        this.setState({show_filters: !this.state.show_filters}, sate=>{
            if (!sate.show_filters)
                this.props.set_proxy_filter('');
        });
    };
    render(){
        const {request_stats, toggle_stats, proxy_filter, set_proxy_filter,
            edit_columns, download_csv} = this.props;
        const rs_tip = 'Recent stats are'
            +` ${request_stats ? 'enabled' : 'disabled'}`;
        return <div className="toolbar">
          <Inline_wrapper>
            <Nav_icon
              icon='Statistic'
              filled={!!request_stats}
              tooltip={rs_tip}
              on_click={()=>toggle_stats(!request_stats)}
            />
            <Nav_divider />
            <Search_box
              show={this.state.show_filters}
              value={proxy_filter}
              on_change={set_proxy_filter}
              placeholder="Port number..."
            />
            <Nav_icon
              icon="Filter"
              on_click={this.toggle_filters}
              tooltip='Filters'
            />
            <Nav_icon
              icon="EyeOn"
              on_click={edit_columns}
              tooltip='Edit proxies columns'
            />
            <Nav_divider />
            <Nav_icon
              icon='Download'
              on_click={download_csv}
              tooltip='Download all proxy ports as CSV'
            />
            <Add_proxy_btn/>
          </Inline_wrapper>
        </div>;
    }
}

export default Toolbar;
