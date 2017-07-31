// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const webpack = require('webpack');
module.exports = {
    context: `${__dirname}/src/pub`,
    entry: {
        app: './app.js',
        vendor: ['jquery', 'lodash', 'moment',
            'angular', 'angular-sanitize', 'angular-ui-bootstrap',
            '@uirouter/angularjs', 'angular-google-analytics',
            'bootstrap', 'bootstrap/dist/css/bootstrap.css',
            'bootstrap-datepicker', 'bootstrap-datepicker/dist/css/bootstrap-'
                +'datepicker3.css',
            'ui-select', 'ui-select/dist/select.css',
            'codemirror/lib/codemirror', 'codemirror/lib/codemirror.css',
            'codemirror/mode/javascript/javascript',
            'react', 'react-dom', 'react-bootstrap', 'axios',
            'regenerator-runtime', 'es6-shim', 'animate.css']
    },
    output: {
        path: `${__dirname}/bin/pub`,
        publicPath: '/',
        filename: '[name].bundle.js',
    },
    plugins: [
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            minChunks: Infinity,
        }),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
        }),
    ],
    module: {
        rules: [
            {
                test: /src[\\\/]pub[\\\/].+\.js$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },
            {
                test: /hutil/,
                parser: {node: false, commonjs: false},
                use: ['hutil-loader'],
            },
            {test: /\.css$/, use: ['style-loader', 'css-loader']},
            {test: /\.less$/, use: ['style-loader', 'css-loader?-url',
                'less-loader']},
            {test: /\.eot(\?v=\d+.\d+.\d+)?$/,
                use: 'url-loader?limit=100000&name=[name].[ext]'},
            {test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/, use: 'url-loader?'
                    +'limit=100000&mimetype=application/font-woff&'
                    +'name=[name].[ext]'},
            {test: /\.[ot]tf(\?v=\d+.\d+.\d+)?$/, use: 'url-loader?'
                    +'limit=100000&mimetype=application/octet-stream'},
            {test: /\.svg(\?v=\d+.\d+.\d+)?$/, use: 'url-loader?'
                +'limit=120000&mimetype=image/svg+xml&name=[name].[ext]'},
            {test: /\.(jpe?g|png|ico|gif)$/, use: 'url-loader?limit=100000'},
        ],
    },
    resolve: {
        alias: {
            app: `${__dirname}/src/pub`,
            '/util': 'hutil/util/',
            jquery: 'jquery/src/jquery.js',
        },
    },
    resolveLoader: {
        alias: {'hutil-loader': `${__dirname}/lib/hutil-loader.js`},
    },
};
