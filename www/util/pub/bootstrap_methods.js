// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
define(['bootstrap/package.json'], function({version})
{

const is_bs3 = String(version||3).startsWith('3');
const E = {};

E.destroy = is_bs3 ? 'destroy' : 'dispose';

E.fix_title = is_bs3 ? 'fixTitle' : '_fixTitle';

return E;

});
