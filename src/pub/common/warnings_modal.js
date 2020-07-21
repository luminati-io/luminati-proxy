// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import {T} from './i18n.js';
import {Modal} from './modals.js';
import {Warnings} from '../common.js';

export default function Warnings_modal(props){
    return <T>{t=>
      <Modal className="warnings_modal" id={props.id} no_cancel_btn
        style={{zIndex: 10000}} title={t(props.title||'Error')}>
        <Warnings warnings={props.warnings}/>
      </Modal>
    }</T>;
}
