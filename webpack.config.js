// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const {merge} = require('webpack-merge');
const common_config = require('./webpack.common.js');
const prod_config = require('./webpack.prod.js');
const dev_config = require('./webpack.dev.js');

const merged = conf=>merge(common_config, conf);
module.exports = env=>{
    switch (env)
    {
    case 'production': return merged(prod_config);
    case 'development': return merged(dev_config);
    default:
        throw new Error(`Webpack configuration for ${env} was not found!`);
    }
};
