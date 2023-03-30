// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
module.exports = function myLoader(source){
    return '\nvar module;\n'+source
    .replace('var define;', '')
    .replace('let define;', '')
    .replace('define,', '')
    .replace(/\{\s*define\s*=[^;]+;([^}]*)\}/gm, '{$1}')
    .replace(/define\s*=.+/g, ';');
};
