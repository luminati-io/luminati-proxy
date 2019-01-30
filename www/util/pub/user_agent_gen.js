 // LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/

define([], function(){

const E = [
    {name: 'Chrome 71 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/71.0.3578.98 Safari/537.36'},
    {name: 'Chrome 71 Windows 7', value: 'Mozilla/5.0 (Windows NT 6.1; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/71.0.3578.98 Safari/537.36'},
    {name: 'Chrome 71 Android 4', value: 'Mozilla/5.0 (Linux; Android 4.1.1; '
        +'Nexus 7 Build/JRO03D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/71.0.3578.99 Safari/537.36'},
    {name: 'Chrome 71 OSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; Intel Mac '
        +'OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/71.0.3579.98 Safari/537.36'},
    {name: 'Chrome 71 Linux', value: 'Mozilla/5.0 (X11; Linux x86_64) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 '
        +'Safari/537.36'},
    {name: 'Chrome 71 iOS 12.1', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS '
        +'12_1 like Mac OS X) AppleWebKit/605.115 (KHTML, like Gecko) '
        +'CriOS/70.0.3538.102 Mobile/15E148 Safari/605.1'},
    {name: 'Chrome 71 Samsung Galaxy S6', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like '
        +'Gecko) Chrome/71.0.3578.99 Mobile Safari/537.36'},
    {name: 'Chromium 70 Linux', value: 'Mozilla/5.0 (X11; Linux x86_64) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/70.0.3538.77 '
        +'Chrome/70.0.3538.77 Safari/537.36'},
    {name: 'Opera 56 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/69.0.3497.100 Safari/537.36 OPR/56.0.3051.52'},
    {name: 'Firefox 63 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64; rv:63.0) Gecko/20100101 Firefox/63.0'},
    {name: 'Firefox 63 Windows 7', value: 'Mozilla/5.0 (Windows NT 6.1; '
        +'WOW64; rv:53.0) Gecko/20100101 Firefox/63.0'},
    {name: 'Firefox 63 OSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; Intel '
        +'Mac OS X 10.14.1; rv:63.0) Gecko/20100101 Firefox/63.0'},
    {name: 'Firefox 63 Linux', value: 'Mozilla/5.0 (X11; Ubuntu; '
        +'Linux x86_64; rv:53.0) Gecko/20100101 Firefox/53.0'},
    // XXX iago: double check android firefox header (gecko specially)
    {name: 'Firefox 63 Android 4.4', value: 'Mozilla/5.0 (Android 4.4; '
        +'Mobile; rv:63.0) Gecko/41.0 Firefox/63.0'},
    {name: 'Safari 12.0.1 MacOSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; '
        +'Intel Mac OS X 10_14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) '
        +'Version/12.0.1 Safari/605.1.15'},
    // XXX iago: double check safari android
    {name: 'Safari Mobile 12.1 Android 4.4', value: 'Mozilla/5.0 (Linux; U; '
        +'Android 4.4; en-gb; GT-P1000 Build/FROYO) AppleWebKit/605.1.15 '
        +'(KHTML, like Gecko) Version/12.1 Mobile Safari/605.1.15'},
    {name: 'Safari Mobile 12.1 iOS 12', value: 'Mozilla/5.0 (iPhone; CPU '
        +'iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like '
        +'Gecko) Version/12.0 Mobile/15E148 Safari/604.1'},
    {name: 'IE 11.0 for Desktop Windows 10', value: 'Mozilla/5.0 (Windows NT '
        +'10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'},
    {name: 'Edge 43 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; '
        +'x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 '
        +'Safari/537.36 Edge/18.17763'},
    {name: 'Samsung Browser 7.2 Samsung Galaxy Tab A', value: 'Mozilla/5.0 '
        +'(Linux; Android 7.0; SAMSUNG SM-T585 Build/NRD90M) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/7.2 '
        +'Chrome/59.0.3071.125 Safari/537.36'},
    // for customer clicksc
    {name: 'Redmi 3S', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Redmi 3S '
        +'Build/MMB29M) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Iris Fuel', value: 'Mozilla/5.0 (Linux; Android 5.1; Iris Fuel F1 '
        +'Build/LMY47I) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 '
        +'Chrome/39.0.0.0 Mobile Safari/537.36'},
    {name: 'Nexus 10', value: 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 10) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 '
        +'Safari/537.36'},
    {name: 'Micromax Q301', value: 'Mozilla/5.0 (Linux; Android 5.1; Micromax '
        +'Q301 Build/LMY47D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/42.0.2311.152 YaBrowser/15.6.2311.6088.00 Mobile '
        +'Safari/537.36'},
    {name: 'Vivo 1723', value: 'Mozilla/5.0 (Linux; Android 8.1.0; vivo 1723 '
        +'Build/OPM1.171019.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.126 Mobile Safari/537.36'},
    {name: 'Pixel XL', value: 'Mozilla/5.0 (Linux; Android 7.1; Pixel XL '
        +'Build/NDE63H) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/54.0.2840.68 Mobile Safari/537.36 (Mobile; '
        +'afma-sdk-a-v10084036.9877000.2)'},
    {name: 'Moto G', value: 'Mozilla/5.0 (Linux; Android 6.0; XT1068) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.80 '
        +'Mobile Safari/537.36'},
    {name: 'Redmi Note 4', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Redmi '
        +'Note 4 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'HTC Desire 828', value: 'Mozilla/5.0 (Linux; Android 5.1; HTC '
        +'Desire 828 dual sim Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/50.0.2661.86 Mobile Safari/537.36'},
    {name: 'Lenovo K53a48', value: 'Mozilla/5.0 (Linux; Android 7.0; Lenovo '
        +'K53a48 Build/NRD90N; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
];
return E;

});
