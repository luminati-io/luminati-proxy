// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es9:true*/
import React, {useState, useEffect, useCallback} from 'react';
import _ from 'lodash4';
import {withRouter} from 'react-router-dom';
import {Modal} from 'uikit';

const Exit_confirm_modal = withRouter(({should_show, history})=>{
    const [show, set_show] = useState(false);
    const [last_change, set_last_change] = useState({});
    const confirm = useCallback(()=>{
        if (!_.isEmpty(last_change))
            history.push(last_change);
    }, [last_change]);
    useEffect(()=>{
        const unblock = history.block(change=>{
            if (!should_show || show)
                return true;
            set_last_change(change);
            set_show(true);
            return false;
        });
        return ()=>unblock();
    }, [should_show, show]);
    return <Modal.Popup
        show={show}
        onOk={confirm}
        onCancel={()=>set_show(false)}
        title="You have unsaved changes"
        content={<h4>Are you sure you want to exit?</h4>}
        shadow="sm"
        size="md"
    />;
});
Exit_confirm_modal.displayName = 'Exit_confirm_modal';

export default Exit_confirm_modal;
