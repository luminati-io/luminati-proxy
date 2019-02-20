// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

export const Li = props=>
    <li>
      <div className="circle_wrapper">
        <div className="circle"/>
      </div>
      <div className="single_instruction">{props.children}</div>
    </li>;

export const Instructions = ({children})=>
    <div className="instructions">
      <ol className="instruction_list">
        {children}
      </ol>
    </div>;
