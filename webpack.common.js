// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const path = require('path');
const webpack = require('webpack');
const html_webpack_plugin = require('html-webpack-plugin');
const netmask_path = path.resolve(__dirname, '../util/netmask.js');
const config_path = path.resolve(__dirname, './util/config.js');
const mk_url_loader = mimetype=>[{
    loader: 'url-loader',
    options: {limit: '100000', fallback: 'file-loader', mimetype},
}];
module.exports = {
    context: `${__dirname}/src/`,
    entry: {
        app: './pub/app.js',
        vendor: ['jquery', 'lodash4', 'moment', 'bootstrap',
        'bootstrap/dist/css/bootstrap.css',
            'react-bootstrap', 'react',
            'react-dom', 'animate.css'],
    },
    output: {
        path: `${__dirname}/bin/pub`,
        publicPath: '/',
        filename: '[chunkhash].[name].js',
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^\.\/locale$/,
            contextRegExp: /moment$/
        }),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
        }),
        new html_webpack_plugin({inject: true, template: './pub/index.html'}),
        new webpack.NormalModuleReplacementPlugin(/^\.\/config\.js$/, res=>{
            const issuer = res.contextInfo && res.contextInfo.issuer;
            if (issuer && path.resolve(issuer)==netmask_path)
                res.request = config_path;
        }),
    ],
    optimization: {
        runtimeChunk: 'single',
        minimize: false,
    },
    watchOptions: {
        poll: true,
        ignored: /node_modules/
    },
    module: {
        rules: [
            {
                test: /src[\\/]pub[\\/].+\.js$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },
            {
                test: /www[\\/].+\.js$/,
                exclude: /node_modules/,
                use: ['hutil-loader', 'babel-loader'],
            },
            {
                test: /util[\\/].+\.js$/,
                parser: {node: false, commonjs: false},
                exclude: [/www[\\/].+\.js$/, /node_modules/, /util[\\/](netmask|config)\.js$/],
                use: ['hutil-loader'],
            },
            {test: /\.css$/, use: ['style-loader', 'css-loader']},
            {test: /\.less$/, use: ['style-loader', 'css-loader?-url',
                'less-loader']},
            {test: /\.eot(\?v=\d+.\d+.\d+)?$/, use: mk_url_loader()},
            {test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: mk_url_loader('application/font-woff')},
            {test: /\.[ot]tf(\?v=\d+.\d+.\d+)?$/,
                use: mk_url_loader('application/octet-stream')},
            {test: /\.svg(\?v=\d+.\d+.\d+)?$/,
                use: mk_url_loader('image/svg+xml')},
            {test: /\.(jpe?g|png|ico|gif)$/, use: mk_url_loader()},
        ],
    },
    resolve: {
        modules: [__dirname, 'node_modules'],
        mainFiles: ['index'],
        alias: {
            '/util': 'util/',
            jquery: 'jquery/src/jquery.js',
            virt_jquery_all: 'jquery/src/jquery.js',
            '/www': 'www/',
            './netmask.js': path.resolve(__dirname, '../util/netmask.js'),
            // './config.js': path.resolve(__dirname, './util/config.js'),
        },
    },
    resolveLoader: {
        alias: {'hutil-loader': `${__dirname}/lib/hutil_loader.js`},
    },
};
