// LICENSE_CODE ZON ISC
'use strict'; /*zlint node, node_ios*/
var zconf = require('./config.js');
var fs = require('fs');
var version;
var paths = ['.', __dirname, __dirname+'/../..', __dirname+'/../../..'];
if (process.browser)
    version = require('zon_config.js').ZON_VERSION;
else if (process.zon)
    version = process.zon.version;
else if (!(version = zconf.ZON_VERSION))
{
    for (var i=0; i<paths.length; i++)
    {
        var m, path = paths[i]+'/CVS/Tag';
        try {
            version = fs.readFileSync(path, 'utf8');
            if (m = version.match(/^Ntag-(\d{1,3})_(\d{1,3})_(\d{1,3})/))
            {
                version = m.slice(1).join('.');
                break;
            }
            version = undefined;
        } catch(e){}
    }
}
version = version ? version.trimRight() : 'unknown';
exports.version = version;
