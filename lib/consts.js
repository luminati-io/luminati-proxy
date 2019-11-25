// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const E = module.exports;

E.NO_PEERS_ERROR_SSL = 'Proxy Error: server_error No peers available';
E.NO_PEERS_ERROR = 'Proxy Error: No peers available';
E.SUCCESS_STATUS_CODE_RE = /([123]..|404)/;
E.SESSION_TERMINATED_BODY = 'Session has been terminated. To connectinue you'
    +' need to refresh the session';
E.TLS_ERROR_MSG = 'TLS error: client has to install certificate';
