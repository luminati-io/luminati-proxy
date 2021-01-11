// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/

define([], function(){

const E = [
    {name: 'Chrome 87 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/87.0.4280.141 Safari/537.36'},
    {name: 'Chrome 87 Windows 7', value: 'Mozilla/5.0 (Windows NT 6.1; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/87.0.4280.141 Safari/537.36'},
    {name: 'Chrome 71 Android 4', value: 'Mozilla/5.0 (Linux; Android 4.1.1; '
        +'Nexus 7 Build/JRO03D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/71.0.3578.99 Safari/537.36'},
    {name: 'Chrome 87 Android 8', value: 'Mozilla/5.0 (Linux; Android 8.1.0; '
        +'Build/OPM1.171019.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36'},
    {name: 'Chrome 87 OSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; Intel Mac '
        +'OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/87.0.4280.141 Safari/537.36'},
    {name: 'Chrome 87 Linux', value: 'Mozilla/5.0 (X11; Linux x86_64) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 '
        +'Safari/537.36'},
    {name: 'Chrome 87 iOS 12.1', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS '
        +'12_1 like Mac OS X) AppleWebKit/605.115 (KHTML, like Gecko) '
        +'CriOS/87.0.4280.77 Mobile/15E148 Safari/605.1'},
    {name: 'Chrome 87 Samsung Galaxy S6', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-G920V Build/MMB29K) AppleWebKit/537.36 (KHTML, like '
        +'Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36'},
    {name: 'Chromium 87 Linux', value: 'Mozilla/5.0 (X11; Linux x86_64) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/70.0.3538.77 '
        +'Chrome/87.0.4280.141 Safari/537.36'},
    {name: 'Opera 73 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/86.0.4240.183 Safari/537.36 OPR/72.0.3815.320'},
    {name: 'Firefox 79 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; '
        +'Win64; x64; rv:63.0) Gecko/20100101 Firefox/84.0'},
    {name: 'Firefox 79 Windows 7', value: 'Mozilla/5.0 (Windows NT 6.1; '
        +'WOW64; rv:53.0) Gecko/20100101 Firefox/84.0'},
    {name: 'Firefox 79 OSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; Intel '
        +'Mac OS X 10.14.1; rv:63.0) Gecko/20100101 Firefox/84.0'},
    {name: 'Firefox 79 Linux', value: 'Mozilla/5.0 (X11; Ubuntu; '
        +'Linux x86_64; rv:53.0) Gecko/20100101 Firefox/84.0'},
    // XXX iago: double check android firefox header (gecko specially)
    {name: 'Firefox 63 Android 4.4', value: 'Mozilla/5.0 (Android 4.4; '
        +'Mobile; rv:63.0) Gecko/41.0 Firefox/63.0'},
    {name: 'Firefox 79 Android 8', value: 'Mozilla/5.0 (Android 8.1.0; '
        +'Mobile; rv:61.0) Gecko/41.0 Firefox/84.1'},
    {name: 'Safari 13.1 MacOSX 10.14.1', value: 'Mozilla/5.0 (Macintosh; '
        +'Intel Mac OS X 10_14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) '
        +'Version/14.0.2 Safari/605.1.15'},
    {name: 'Safari Mobile 12.1 iOS 12', value: 'Mozilla/5.0 (iPhone; CPU '
        +'iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like '
        +'Gecko) Version/14.0 Mobile/15E148 Safari/12.1.2'},
    {name: 'IE 11.0 for Desktop Windows 10', value: 'Mozilla/5.0 (Windows NT '
        +'10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'},
    {name: 'Edge 86 Windows 10', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; '
        +'x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4280.88 '
        +'Safari/537.36 Edge/86.0.664.66'},
    {name: 'Samsung Browser 11.2 Samsung Galaxy Tab A', value: 'Mozilla/5.0 '
        +'(Linux; Android 7.0; SAMSUNG SM-T585 Build/NRD90M) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/12.1 '
        +'Chrome/79.0.3945.136 Safari/537.36'},
    // for customer clicksc
    {name: 'Redmi 3S', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Redmi 3S '
        +'Build/MMB29M) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Iris Fuel', value: 'Mozilla/5.0 (Linux; Android 5.1; Iris Fuel F1 '
        +'Build/LMY47I) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 '
        +'Chrome/39.0.0.0 Mobile Safari/537.36'},
    {name: 'Nexus 10', value: 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 10) '
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 '
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
        +'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 '
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
    {name: 'Chrome 48 Vivo Y51L', value: 'Mozilla/5.0 (Linux; Android 5.0.2; '
        +'vivo Y51L Build/LRX22G; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/48.0.2564.106 Mobile Safari/537.36'},
    {name: 'Chrome 66 Vivo Y51L', value: 'Mozilla/5.0 (Linux; Android 5.0.2; '
        +'vivo Y51L Build/LRX22G; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.126 Mobile Safari/537.36'},
    {name: 'Chrome 68.0.3440.85 Vivo Y51L', value: 'Mozilla/5.0 (Linux; '
        +'Android 5.0.2; vivo Y51L Build/LRX22G; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/68.0.3440.85 '
        +'Mobile Safari/537.36'},
    {name: 'Chrome 68.0.3440.91 Vivo Y51L', value: 'Mozilla/5.0 (Linux; '
        +'Android 5.0.2; vivo Y51L Build/LRX22G; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/68.0.3440.91 '
        +'Mobile Safari/537.36'},
    {name: 'Sony Xperia MA Aqua E2363', value: 'Mozilla/5.0 (Linux; '
        +'Android 5.0; E2363 Build/26.1.B.3.109; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/42.0.2311.138 '
        +'Mobile Safari/537.36'},
    {name: 'LG D855', value: 'Mozilla/5.0 (Linux; Android 5.0; LG-D855 '
        +'Build/LRX21R.A1445306351; wv) AppleWebKit/537.36 (KHTML, like '
        +'Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Oppo A33f', value: 'Mozilla/5.0 (Linux; Android 5.1.1; A33f '
        +'Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/43.0.2357.121 Mobile Safari/537.36'},
    {name: 'Chrome 46 Oppo A37f', value: 'Mozilla/5.0 (Linux; Android 5.1.1; '
        +'A37f Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/46.0.2490.76 Mobile Safari/537.36'},
    {name: 'Chrome 59 Oppo A37f', value: 'Mozilla/5.0 (Linux; Android 5.1.1; '
        +'A37f Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/59.0.3071.125 Mobile Safari/537.36'},
    {name: 'Chrome 68 Oppo A37f', value: 'Mozilla/5.0 (Linux; Android 5.1.1; '
        +'A37f Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Oppo F1f', value: 'Mozilla/5.0 (Linux; Android 5.1.1; F1f '
        +'Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/64.0.3282.137 Mobile Safari/537.36'},
    {name: 'Chrome 66 Lenovo A6020a40', value: 'Mozilla/5.0 (Linux; Android '
        +'5.1.1; Lenovo A6020a40 Build/LMY47V; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 '
        +'Mobile Safari/537.36'},
    {name: 'Chrome 69 Lenovo A6020a40',
        value: 'Mozilla/5.0 (Linux; Android 5.1.1; Lenovo A6020a40 '
        +'Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Chrome 55 Samsung Galaxy J5', value: 'Mozilla/5.0 (Linux; Android '
        +'5.1.1; SM-J500F Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Vivo Y21L', value: 'Mozilla/5.0 (Linux; Android 5.1.1; vivo Y21L '
        +'Build/LMY47V; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/65.0.3325.109 Mobile Safari/537.36'},
    {name: 'Chrome 46 Oppo F1S', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'A1601 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/46.0.2490.76 Mobile Safari/537.36'},
    {name: 'Chrome 63 Oppo F1S', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'A1601 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36'},
    {name: 'Chrome 65 Oppo F1S', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'A1601 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/65.0.3325.109 Mobile Safari/537.36'},
    {name: 'Chrome 69.0.3497.100 Oppo F1S', value: 'Mozilla/5.0 (Linux; '
        +'Android 5.1; A1601 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Chrome 69.0.3497.91 Oppo F1S', value: 'Mozilla/5.0 (Linux; '
        +'Android 5.1; A1601 Build/LMY47I; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/69.0.3497.91 '
        +'Mobile Safari/537.36'},
    {name: 'Aqua Sense 5.1', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Aqua_Sense_5_1 Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/43.0.2357.121 Mobile Safari/537.36'},
    {name: 'Blu Neo X', value: 'Mozilla/5.0 (Linux; Android 5.1; BLU NEO X '
        +'Build/N070; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/46.0.2490.76 Mobile Safari/537.36'},
    {name: 'Coolpad Note 3', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'CP8676_I02 Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/43.0.2357.121 Mobile Safari/537.36'},
    {name: 'Eluga Turbo', value: 'Mozilla/5.0 (Linux; Android 5.1; ELUGA '
        +'Turbo Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Eluga I2', value: 'Mozilla/5.0 (Linux; Android 5.1; ELUGA_I2 '
        +'Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36'},
    {name: 'G-Tide Extreme 4G', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'G-TiDE Extreme 4G Build/LMY47D) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/39.0.0.0 Mobile Safari/537.36'},
    {name: 'HTC Desire 628', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'HTC Desire 628 dual sim Build/LMY47D; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/60.0.3112.116 '
        +'Mobile Safari/537.36'},
    {name: 'Huawei Tag-L21', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'HUAWEI GR3 Build/HUAWEITAG-L21; wv) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) Version/4.0 Chrome/69.0.3497.100 '
        +'Mobile Safari/537.36'},
    {name: 'Lava V5', value: 'Mozilla/5.0 (Linux; Android 5.1; LAVA V5 '
        +'Build/LMY47D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/50.0.2661.89 Mobile Safari/537.36'},
    {name: 'Lenovo A2010-a', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Lenovo A2010-a Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/59.0.3071.92 Mobile Safari/537.36'},
    {name: 'Lyf Flame 7S', value: 'Mozilla/5.0 (Linux; Android 5.1; LS-4008 '
        +'Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/48.0.2564.106 Mobile Safari/537.36'},
    {name: 'Huawei Y3 II', value: 'Mozilla/5.0 (Linux; Android 5.1; LUA-L22 '
        +'Build/HUAWEILUA-L22; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/50.0.2661.86 Mobile Safari/537.36'},
    {name: 'Micromax Q301', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Micromax Q301 Build/LMY47D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/42.0.2311.152 YaBrowser/15.6.2311.6088.00 '
        +'Mobile Safari/537.36'},
    {name: 'Micromax Q326', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Micromax Q326 Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/46.0.2490.76 Mobile Safari/537.36'},
    {name: 'Micromax Q338', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Micromax Q338 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Maxwest Nitro 4', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'Nitro_4 Build/LMY47D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/50.0.2661.86 Mobile Safari/537.36'},
    {name: 'Gionee Pioneer P5L', value: 'Mozilla/5.0 (Linux; Android 5.1; P5L '
        +'Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/50.0.2661.86 Mobile Safari/537.36'},
    {name: 'Titan LTE', value: 'Mozilla/5.0 (Linux; Android 5.1; TITAN LTE '
        +'Build/LMY47D) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/61.0.3163.98 Mobile Safari/537.36'},
    {name: 'Chrome 68 Oppo F1 Plus', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'X9009 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Chrome 69 Oppo F1 Plus', value: 'Mozilla/5.0 (Linux; Android 5.1; '
        +'X9009 Build/LMY47I; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Asus Zenfone 2 Laser', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'ASUS_Z00LD Build/MMB29P; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36'},
    {name: 'Chrome 61 Oppo A57', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'CPH1701 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/61.0.3163.98 Mobile Safari/537.36'},
    {name: 'Chrome 67 Oppo A57', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'CPH1701 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/67.0.3396.81 Mobile Safari/537.36'},
    {name: 'Chrome 69 Oppo A57', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'CPH1701 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Swipe Elite Sense', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'Elite Sense Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Lyf Water F1', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'LS-5505 Build/LYF_LS-5505_01_10; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/60.0.3112.116 Mobile Safari/537.36'},
    {name: 'Moto G3', value: 'Mozilla/5.0 (Linux; Android 6.0.1; MotoG3 '
        +'Build/MPIS24.107-55-2-17; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Nexus 5', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'Nexus 5 Build/M4B30Z) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/59.0.3071.125 Mobile Safari/537.36'},
    {name: 'Nexus 6P', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'Nexus 6P Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/47.0.2526.83 Mobile Safari/537.36'},
    {name: 'Chrome 66 OnePlus 2', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'ONE A2003 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36'},
    {name: 'Chrome 68 OnePlus 2', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'ONE A2003 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Chrome 69 Redmi 3S', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'Redmi 3S Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Redmi Note 3', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Redmi '
        +'Note 3 Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Chrome 44 Samsung Galaxy J5 Prime', value: 'Mozilla/5.0 (Linux; '
        +'Android 6.0.1; SAMSUNG SM-G570F Build/MMB29K) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 '
        +'Mobile Safari/537.36'},
    {name: 'Chrome 51 Samsung Galaxy J5 Prime', value: 'Mozilla/5.0 (Linux; '
        +'Android 6.0.1; SAMSUNG SM-G570F Build/MMB29K) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) SamsungBrowser/5.4 Chrome/51.0.2704.106 '
        +'Mobile Safari/537.36'},
    {name: 'Samsung Galaxy J7 Prime', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SAMSUNG SM-G610F Build/MMB29K) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) SamsungBrowser/5.4 Chrome/51.0.2704.106 '
        +'Mobile Safari/537.36'},
    {name: 'Chrome 51 Samsung Galaxy S5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SAMSUNG SM-G900I Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) SamsungBrowser/5.4 Chrome/51.0.2704.106 '
        +'Mobile Safari/537.36'},
    {name: 'Samsung Galaxy S6 Edge', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SAMSUNG SM-G925I Build/MMB29K) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 Mobile '
        +'Safari/537.36'},
    {name: 'Chrome 44 Samsung Galaxy J5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SAMSUNG SM-J500F Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 '
        +'Mobile Safari/537.36'},
    {name: 'Chrome 44 Samsung Galaxy Note 4', value: 'Mozilla/5.0 (Linux; '
        +'Android 6.0.1; SAMSUNG SM-N910G Build/MMB29M) AppleWebKit/537.36 '
        +'(KHTML, like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 '
        +'Mobile Safari/537.36'},
    {name: 'Samsung J2 Prime', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'SM-G600FY Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Chrome 55 Samsung Galaxy S5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-G900I Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Chrome 57 Samsung Galaxy S5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-G900I Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/57.0.2987.132 Mobile Safari/537.36'},
    {name: 'Samsung Galaxy S6', value: 'Mozilla/5.0 (Linux; Android 6.0.1; '
        +'SM-G920I Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Chrome/59.0.3071.125 Mobile Safari/537.36'},
    {name: 'Chrome 52 Samsung Galaxy J2', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J210F Build/MMB29Q; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/52.0.2743.98 Mobile Safari/537.36'},
    {name: 'Chrome 69 Samsung Galaxy J2', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J210F Build/MMB29Q; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Chrome 59 Samsung Galaxy J5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J500F Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36'},
    {name: 'Chrome 50 Samsung Galaxy J7', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J700F Build/MMB29K) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/50.0.2661.89 Mobile Safari/537.36'},
    {name: 'Chrome 59 Samsung Galaxy J7', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J700F Build/MMB29K) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36'},
    {name: 'Chrome 55 Samsung Galaxy J7', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J700F Build/MMB29K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Chrome 66 Samsung Galaxy J7', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J700F Build/MMB29K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/66.0.3359.126 Mobile Safari/537.36'},
    {name: 'Chrome 69 Samsung Galaxy J7', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-J700F Build/MMB29K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Chrome 55 Samsung Galaxy Note 4', value: 'Mozilla/5.0 (Linux; '
        +'Android 6.0.1; SM-N910G Build/MMB29M) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Samsung Galaxy Note 5', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0.1; SM-N920G Build/MMB29K) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Chrome/57.0.2987.132 Mobile Safari/537.36'},
    {name: 'Vivo 1603', value: 'Mozilla/5.0 (Linux; Android 6.0.1; vivo 1603 '
        +'Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Vivo 1606', value: 'Mozilla/5.0 (Linux; Android 6.0.1; vivo 1606 '
        +'Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Vivo 1610', value: 'Mozilla/5.0 (Linux; Android 6.0.1; vivo 1610 '
        +'Build/MMB29M; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/61.0.3163.98 Mobile Safari/537.36'},
    {name: 'Aqua Shine 4G', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Aqua Shine 4G Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/44.0.2403.119 Mobile Safari/537.36'},
    {name: 'BMobile AX685', value: 'Mozilla/5.0 (Linux; Android 6.0; AX685 '
        +'Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/44.0.2403.119 Mobile Safari/537.36'},
    {name: 'Chrome 55 Oppo F3', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'CPH1609 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Chrome 66 Oppo F3', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'CPH1609 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36'},
    {name: 'Chrome 67 Oppo F3', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'CPH1609 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/67.0.3396.87 Mobile Safari/537.36'},
    {name: 'Chrome 69 Oppo F3', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'CPH1609 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Eko Star G50', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'EKO_Star_G50E Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Eko Mobile Sole POP 4.0', value: 'Mozilla/5.0 (Linux; Android '
        +'6.0; EKO4.0 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'},
    {name: 'Eluga Prim', value: 'Mozilla/5.0 (Linux; Android 6.0; ELUGA Prim '
        +'Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/67.0.3396.87 Mobile Safari/537.36'},
    {name: 'F3 Prime', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'F3Prime Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/56.0.2924.87 Mobile Safari/537.36'},
    {name: 'Chrome 56 Gionee P7', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'GIONEE P7 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/56.0.2924.87 Mobile Safari/537.36'},
    {name: 'Chrome 69 Gionee P7', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'GIONEE P7 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'ZTE Grand X', value: 'Mozilla/5.0 (Linux; Android 6.0; Grand X '
        +'Build/HDGrand X) AppleWebKit/537.36 (KHTML. like Gecko) '
        +'Version/4.0 Chrome/39.0.0.0 Mobile Safari/537.36'},
    {name: 'Aqua Lions 4G', value: 'Mozilla/5.0 (Linux; Android 6.0; INTEX '
        +'AQUA LIONS 4G Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Lenovo A7000', value: 'Mozilla/5.0 (Linux; Android 6.0; Lenovo '
        +'A7000-a Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/67.0.3396.87 Mobile Safari/537.36'},
    {name: 'Lenovo Vibe K5 Note', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Lenovo A7020a48 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/67.0.3396.87 Mobile Safari/537.36'},
    {name: 'Lenovo A7700', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Lenovo A7700 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/48.0.2564.106 Mobile Safari/537.36'},
    {name: 'LG G4', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'LG-H818 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36'},
    {name: 'Micromax Q4001', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Micromax Q4001 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
    {name: 'Micromax Q4101', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Micromax Q4101 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, '
        +'like Gecko) Version/4.0 Chrome/52.0.2743.98 Mobile Safari/537.36'},
    {name: 'Maxwest Nitro 5M', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'Nitro_5M Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/52.0.2743.98 Mobile Safari/537.36'},
    {name: 'Lava P7 Plus', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'P7plus Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/67.0.3396.87 Mobile Safari/537.36'},
    {name: 'Plum Optimax 7.0', value: 'Mozilla/5.0 (Linux; Android 6.0; '
        +'PLUM Z709 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/54.0.2840.85 Safari/537.36'},
    {name: 'Vivo 1601', value: 'Mozilla/5.0 (Linux; Android 6.0; vivo 1601 '
        +'Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
        +'Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36'},
];
return E;

});
