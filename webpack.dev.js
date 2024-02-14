// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const webpack = require('webpack');
module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    plugins: [
        new webpack.DefinePlugin({
            ENV_DEV: JSON.stringify(true),
            ENV_PROD: JSON.stringify(false),
        }),
    ]
};
