// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const webpack = require('webpack');
module.exports = {
    mode: 'production',
    plugins: [
        new webpack.DefinePlugin({
            ENV_DEV: JSON.stringify(false),
            ENV_PROD: JSON.stringify(true),
        }),
    ]
};
