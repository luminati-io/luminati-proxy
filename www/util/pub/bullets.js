// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
define(['react', '/www/util/pub/css/bullets.less'],
    React=>
{
const E = {};

const Li = ({children})=>
    <li>
      <div className="circle_wrapper">
        <div className="circle"/>
      </div>
      <div className="single_instruction">
        {children}
      </div>
    </li>;
E.Li = Li;

const Instructions = ({children})=>
    <div className="instructions">
      <ol className="instruction_list">
        {children}
      </ol>
    </div>;
E.Instructions = Instructions;

return E; });
