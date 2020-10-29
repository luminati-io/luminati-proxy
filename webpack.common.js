// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
const webpack = require('webpack');
const html_webpack_plugin = require('html-webpack-plugin');
const mk_url_loader = mimetype=>[{
    loader: 'url-loader',
    options: {limit: '100000', fallback: 'file-loader', mimetype},
}];
module.exports = {
    context: `${__dirname}/src/pub`,
    entry: {
        app: './app.js',
        vendor: ['jquery', 'lodash', 'moment', 'bootstrap',
            'bootstrap/dist/css/bootstrap.css', 'codemirror/lib/codemirror',
            'codemirror/lib/codemirror.css', 'react-bootstrap', 'react',
            'codemirror/mode/javascript/javascript', 'react-dom',
            'regenerator-runtime', 'es6-shim', 'animate.css'],
    },
    output: {
        path: `${__dirname}/bin/pub`,
        publicPath: '/',
        filename: '[chunkhash].[name].js',
    },
    plugins: [
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
        }),
        new html_webpack_plugin({inject: true, template: 'index.html'}),
    ],
    optimization: {
        runtimeChunk: 'single',
        minimize: false,
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
                exclude: [/www[\\/].+\.js$/, /node_modules/],
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
        alias: {
            '/util': 'util/',
            jquery: 'jquery/src/jquery.js',
            virt_jquery_all: 'jquery/src/jquery.js',
            '/www': 'www/',
        },
    },
    resolveLoader: {
        alias: {'hutil-loader': `${__dirname}/lib/hutil_loader.js`},
    },
};
