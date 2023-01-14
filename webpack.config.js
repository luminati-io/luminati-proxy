// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const {merge} = require('webpack-merge');
const common_config = require('./webpack.common.js');
const prod_config = require('./webpack.prod.js');
const dev_config = require('./webpack.dev.js');

const merged = conf=>merge(common_config, conf);

const from_obj = env=>{
    if (env.production)
        return merged(prod_config);
    if (env.development)
        return merged(dev_config);
    throw new Error(`Webpack configuration for ${JSON.stringify(env)}`
        +' was not found!');
};

const from_str = env=>{
    switch (env)
    {
    case 'production': return merged(prod_config);
    case 'development': return merged(dev_config);
    default:
        throw new Error(`Webpack configuration for ${env} was not found!`);
    }
};

module.exports = env=>typeof env==='string' ? from_str(env) : from_obj(env);
