// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, evil: true*/
const date = require('../util/date.js');
const E = module.exports;

E.NO_PEERS_ERROR_SSL = 'Proxy Error: server_error No peers available';
E.NO_PEERS_ERROR = 'Proxy Error: No peers available';
E.SUCCESS_STATUS_CODE_RE = /([123]..|404)/;
E.SESSION_TERMINATED_BODY = 'Session has been terminated. To connectinue you '
    +'need to refresh the session';
E.TLS_ERROR_MSG = 'TLS error: client has to install certificate';
E.HIGH_CPU_THRESHOLD = 98;
E.UPGRADE_CHECK_INTERVAL = 10*date.ms.MIN;
E.UPGRADE_IDLE_PERIOD = 30*date.ms.MIN;
E.ZAGENT_API_PORT = 3395;
E.MAX_STRING_LENGTH = 300;
E.MAX_URL_LENGTH = 1024;
E.MAX_EXT_PROXIES = 100;
E.CACHE_LIMIT = 1e8;
E.SOURCES = {API: 'API', UI: 'UI'};
E.USERNAME_PREFS = ['brd', 'lum'];
E.MAX_WS_REFRESH_RETRIES = 10;
E.WS_REFRESH_INTERVAL = 10*date.ms.MIN;
E.WS_REFRESH_RESON = 'Refresh lpm_f connection';
E.VIPDB_RELOAD_TIMEOUT = date.ms.MIN;
E.RL_MAX_REQS = 100;
E.RL_WINDOW = date.ms.MIN;
