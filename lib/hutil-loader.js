// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
module.exports = function myLoader(source){
    return '\nvar module;\n'+source.replace('var define;', '')
        .replace('define,', '').replace(/define\s*=.+/g, ';');
};
