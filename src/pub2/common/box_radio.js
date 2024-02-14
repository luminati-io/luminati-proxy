// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React, {useCallback} from 'react';
import _ from 'lodash4';
import {Badge, Icon, Typography, Tooltip, theme} from 'uikit';
import styled from 'styled-components';
import classnames from 'classnames';
import {T} from './i18n.js';
import '../css/box_radio.less';

const Input_radio_btn = ({class_name, name, value, label, id, checked,
    on_change})=>{
    const el_id = [id, name, value].filter(Boolean).join('_');
    const classname = classnames('form_new_radio_btn', class_name);
    return <div className={classname}>
      <input id={el_id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={on_change}
      />
      {label&&<label htmlFor={el_id}>{label}</label>}
    </div>;
};

const Box_radio_option = props=>{
    const {title, body, checked, value, on_change, classes, disabled, icon,
        root_mark, tooltip} = props;
    const on_change_handler = useCallback(()=>{
        if (!disabled)
            on_change(value);
    }, [value, on_change, disabled]);
    const base_class = 'box_radio_opt';
    const class_name = classnames(base_class, checked&&'checked',
        disabled&&'disabled', classes);
    const label_classes = classnames(`${base_class}-text_title`, {root_mark});
    const body_el = _.isString(body) ? <T>{body}</T> : body;
    return <Tooltip tooltip={tooltip}>
      <div onClick={on_change_handler} className={class_name}>
        <Input_radio_btn id={`box_radio-${value}`} checked={checked}
          value={value}/>
        {icon&&<Styled_badge>
          <Icon color="blue_11" size="sm" name={icon}/>
        </Styled_badge>}
        <div className={`${base_class}-text`}>
          <Typography.Label classes={label_classes} variant="lg">
            {title}
          </Typography.Label>
          {body_el&&<span>{body_el}</span>}
        </div>
      </div>
    </Tooltip>;
};

const Box_radio = props=>{
    const {options, value, on_change, disabled, classes} = props;
    const base_class = 'box_radio';
    const class_name = classnames(base_class, classes);
    return <div className={class_name}>
      {options.map(o=><Box_radio_option key={`box_radio_${o.value}`}
        title={o.label} body={o.desc} checked={value==o.value}
        value={o.value} on_change={on_change} icon={o.icon}
        disabled={disabled||o.disabled} root_mark={o.root_mark}
        tooltip={o.tooltip} classes={`${base_class}_${o.value}`}/>)}
    </div>;
};

const Styled_badge = styled(Badge)`
    background-color: ${theme.color.blue_4};
    padding: 10px;
`;

export default Box_radio;
