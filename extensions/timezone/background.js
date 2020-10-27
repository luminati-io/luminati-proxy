// LICENSE_CODE ZON
'use strict'; /*jslint browser:true, es6:true, react:true*//*global chrome*/

const df = new Date().getTimezoneOffset();

const on_committed = ({url, tabId, frameId})=>{
    const timezone_id = localStorage.getItem('timezone_id');
    const offset = localStorage.getItem('offset');
    const content = `Date.prefs = ["${timezone_id}", ${-1*offset}, ${df}]`;
    if (!(url && url.startsWith('http')))
        return;
    chrome.tabs.executeScript(tabId, {
        runAt: 'document_start',
        frameId,
        matchAboutBlank: true,
        code: 'document.documentElement.appendChild(Object.assign('
            +`document.createElement('script'), {textContent: '${content}'}))`
            +'.remove();',
    }, ()=>chrome.runtime.lastError);
};

window._init = ({timezone_id, offset})=>{
    localStorage.setItem('timezone_id', timezone_id);
    localStorage.setItem('offset', offset);
    chrome.webNavigation.onCommitted.addListener(on_committed);
};
