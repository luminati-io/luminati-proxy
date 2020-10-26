// LICENSE_CODE ZON
'use strict'; /*jslint browser:true, es6:true, react:true*//*global chrome*/

const inject = (tab_id, a, b)=>{
    chrome.tabs.executeScript(tab_id, a, ()=>{
        chrome.tabs.executeScript(tab_id, b, ()=>chrome.runtime.lastError);
    });
};

const inject_opt = frame_id=>({
    allFrames: true,
    matchAboutBlank: true,
    runAt: 'document_start',
    frameId: frame_id,
});

const on_committed = timezone_opt=>e=>{
    if (!e.url.startsWith('http') || e.url.includes('luminati'))
        return;
    inject(e.tabId, {
        ...inject_opt(e.frameId),
        code: `const timezone_opt = ${JSON.stringify(timezone_opt)};`,
    }, {
        ...inject_opt(e.frameId),
        file: 'inject.js',
    });
};

window.init_tz_listener = timezone_opt=>{
    chrome.webNavigation.onCommitted.addListener(on_committed(timezone_opt));
};
