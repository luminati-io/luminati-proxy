// LICENSE_CODE ZON
'use strict'; /*jslint browser:true, es6:true*//*global chrome*/

chrome.privacy.network.webRTCIPHandlingPolicy
    .set({value: 'disable_non_proxied_udp'});

