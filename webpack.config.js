// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const webpack = require('webpack');
const html_webpack_plugin = require('html-webpack-plugin');
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
        filename: '[chunkhash].[name].js',
    },
    plugins: [
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
        new webpack.optimize.CommonsChunkPlugin({
            names: ['vendor', 'runtime'],
            minChunks: Infinity,
        }),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
        }),
        new html_webpack_plugin({inject: true, template: 'index.html'}),
    ],
    module: {
        rules: [
            {
                test: /src[\\\/]pub[\\\/].+\.js$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },
            {
                test: /www[\\\/].+\.js$/,
                exclude: /node_modules/,
                use: ['hutil-loader', 'babel-loader'],
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
        modules: [__dirname, 'node_modules'],
        alias: {
            '/util': 'hutil/util/',
            jquery: 'jquery/src/jquery.js',
            virt_jquery_all: 'jquery/src/jquery.js',
            '/www': 'www/',
        },
    },
    resolveLoader: {
        alias: {'hutil-loader': `${__dirname}/lib/hutil-loader.js`},
    },
};
