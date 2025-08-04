// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
define(['bootstrap/package.json'], function({version})
{

const is_bs3 = String(version||3).startsWith('3');
const E = {};

E.destroy = is_bs3 ? 'destroy' : 'dispose';

E.fix_title = is_bs3 ? 'fixTitle' : '_fixTitle';

E.data_attrs = attrs=>Object.entries(attrs||{}).reduce((acc, [k, v])=>
    Object.assign(acc, {['data-'+k]: v}), {});

E.data_bs_attrs = attrs=>Object.entries(attrs||{}).reduce((acc, [k, v])=>
    Object.assign(acc, {['data-bs-'+k]: v}), {});

E.data_all_attrs = attrs=>Object.entries(attrs||{}).reduce((acc, [k, v])=>
    Object.assign(acc, {['data-'+k]: v, ['data-bs-'+k]: v}), {});

return E;

});
