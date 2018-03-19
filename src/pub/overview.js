// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Proxies from './proxies.js';
import Recent_stats from './stats/stats.js';

const Overview = ()=>(
    <div className="overview lpm">
      <div className="proxies nav_header">
        <h3>Overview</h3>
      </div>
      <div className="col-lg-8 lpm proxies proxies_wrapper">
        <Proxies/>
      </div>
      <div className="col-lg-4 stats_wrapper">
        <Recent_stats/>
      </div>
    </div>
);

export default Overview;
