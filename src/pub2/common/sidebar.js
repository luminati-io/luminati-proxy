// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {IconButton, theme} from 'uikit';
import styled from 'styled-components';

const SidebarItemsBottomWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 2px 24px;
`;

const SidebarItemsTopWrapper = styled(SidebarItemsBottomWrapper)`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 2px 24px;
    margin-top: 70px;
`;

const SidebarItem = styled(IconButton).attrs(props=>({
  variant: 'icon',
  tooltipPlacement: 'right',
  'data-active': props.active?'':undefined,
}))`
  && {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      border: 1px solid ${theme.color.white};
      svg { 
          color: ${theme.color.gray_10};
          width: 24px;
          height: 24px;
      }
      &[data-active] {
          background-color: ${theme.color.blue_2};
          border: 1px solid ${theme.color.blue_2};
          svg { color: ${theme.color.blue_11}; }
      }
      &:hover:not(:disabled) {
          background-color: ${theme.color.blue_2};
          border: 1px solid ${theme.color.blue_2};
          svg { color: ${theme.color.blue_11}; }
      }
      &:active:not(:disabled) {
          background-color: ${theme.color.white};
          border: 1px solid ${theme.color.gray_4};
          svg { color: ${theme.color.blue_11}; }
      }
  }
`;

const SidebarContainer = styled.aside`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 8px 12px;
    border-right: 1px solid ${theme.color.gray_5};
    box-sizing: content-box;
    width: 52px;
    height: 100%;
`;

const Sidebar = props=>{
  const {items, bottom_items, settings_item} = props;
  const sidebar_items = Array.isArray(items)?
      items.map(item=><SidebarItem key={item.id} {...item}/>):
      items;
  const sidebar_bottom_items = Array.isArray(bottom_items)?
      bottom_items.map(item=><SidebarItem key={item.id} {...item}/>):
      bottom_items;
  return <SidebarContainer data-layout="sidebar">
    <SidebarItemsTopWrapper style={{marginBottom: 'auto'}}>
      {sidebar_items}
    </SidebarItemsTopWrapper>
    <SidebarItemsBottomWrapper>
      {sidebar_bottom_items}
      {settings_item && <SidebarItem icon="Gear" {...settings_item}/>}
    </SidebarItemsBottomWrapper>
  </SidebarContainer>;
};
Sidebar.displayName = 'Sidebar';

export default Sidebar;
