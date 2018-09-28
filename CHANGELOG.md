Luminati Proxy manager - Change Log

## 1.108.399 Development Latest
- :star: Migration to node 10.X
- :star: Performance improvements

## 1.108.119 Stable
- :star: Updated dependencies
- :star: New rule: switch proxy port based on URL

## 1.108.6 Development Latest
- :sparkles: Logs speed optimization

## 1.107.868 Stable
- :bug: Bug fixes
- :sparkles: Rule: 'request time more than' improved

## 1.107.808 Stable
- :bug: Fix windows installation

## 1.107.802 Stable
- :sparkles: SSL stability improvements
- :bug: Bug fixes

## 1.107.727 Stable
- :bug: Fixed rules with a status code regex
- :sparkles: Better labels for request time rules
- :bug: Fixed reading legacy config file

## 1.107.671 Stable
- :star: UI performance optimizations

## 1.107.599 Stable
- :bug: SOCKS5 improvements

## 1.107.580 Stable
- :bug: Fixed support of 25 port in SOCKS5 connections
- :star: Stats optimizations

## 1.107.348 Stable
- :star: HAR viewer improved
- :star: dropin port can be disabled in config

## 1.107.220 Stable
- :bug: Bug fixes

## 1.106.970 Stable
- :star: Fixes in Link Tester

## 1.106.873 Stable
- :star: Stability and performance improvements

## 1.106.784 Stable
- :bug: Fix Link Tester

## 1.106.519 Stable
- :star: Proxy Tester improvements
- :star: UI fixes

## 1.106.377 Stable
- :star: Link Tester improvements
- :bug: Fix bypass requests mem leak

## 1.106.262 Stable
- :bug: Fix wrong async logging initialization

## 1.106.222 Stable
- :bug: Fix waterfall rule
- :bug: Fix UI of Targeting tab
- :star: Added 'screenshot' param to Link Tester

## 1.106.128 Development Latest
- :bug: Fix memory and unfinished async tasks leaks

## 1.106.0 Stable
- :star: Improvements in database management, more control over how many requests to keep
- :bug: Bug fixes in Link Affiliate Tester

## 1.105.672 Stable
- :bug: Fixed taking screenshot in Link Tester on windows
- :bug: Added the note to status codes and timings in the logs when SSL analyzing is off

## 1.105.395 Development Latest
- :star: Added mail notifications in the Rules module
- :star: Added support for choosing a country of Super Proxy
- :bug: Solved inconsistency in the presets

## 1.104.508 Stable
- :bug: Fixed disappearing proxy ports
- :star: Added PID of the request to the logs

## 1.104.371 Stable
- :bug: Fixed daemon mode
- :star: Added an IP of the request sender to the logs

## 1.104.180 Development Latest
- :bug: Fixed memory leak (when Rule with HTML body is set)
- :star: Moved 'Regexp for null response' config into Rules tab
- :star: Moved 'Regexp for bypass proxy' config into Rules tab
- :star: Moved 'Regexp for super proxy' config into Rules tab

## 1.103.790 
- :sparkles: Added regexp generator

## 1.103.508 Stable
- :star: added Link Tester API

## 1.103.296 Stable
- :bug: Fix mem leak via hanging events

## 1.102.979 Stable
- :star: Added "U-Mobile" carrier in targeting options
- :star: Added fast IPs pool
- :sparkles: Closing inactive sockets in order to avoid memory leaks

## 1.101.871 Development Latest
- :star: Added "Refresh IP" Rule
- :star: Forwarding for google domains
- :sparkles: Whitelist block page instructions
- :sparkles: "Admin Whitelisted IPs" option available in General Settings

## 1.101.406 Stable
- :bug: Avoid lowercasing headers for proxied requests

## 1.101.384 Stable
- :bug: Fixed managing history db
- :bug: Fixed Proxy Tester when sending concurrent requests
- :star: Improved Test Affiliate tab

## 1.101.324 Development Latest
- :star: Added button to open a modal with IPs/gIPs
- :star: New tab in proxy configuration: Headers
- :star: Refreshing IPs/gIPs from LPM
- :bug: Fixed memory leaks
- :star: Improved performance
- :bug: Fixed web access security issue
- :bug: Fixed BW up and BW down in proxies list
- :star: improved Timeline in logs: waterfall and other rules are visible
- :star: added taking screenshots in 'Test affiliate links'
- :sparkles: move logs to luminati_proxy_manager dir
- :star: changed SOCKS 5 port to be the same as main proxy port
- :bug: fixed countries list for global shared zones
- :bug: fixed dialog on port conflict in electron app
- :bug: no version in exe name (for resident tasks)
- :star: HAR viewer improvements

## 1.101.34 Development Latest
- :star: Refreshing IPs/gIPs from LPM
- :star: UI improvements and additional tooltips

## 1.100.731 Stable
- :bug: Fixed memory leaks
- :star: Improved performance
- :bug: Fixed web access security issue

## 1.100.623 Stable
- :bug: Fixed initializing web sockets

## 1.100.537 Stable
- :bug: Fixed BW up and BW down in proxies list
- :bug: Stopped logging small issues to the console

## 1.100.496 Stable
- :bug: Fixed Test Affiliate redirections

## 1.100.410 Development Latest
- :bug: Fixed installation script node version dependency

## 1.100.341 Stable
- :bug: fixed city selection in targeting options

## 1.100.333 Stable
- :bug: added handling TCP errors

## 1.100.316 Stable
- :bug: fixed providing ASN manually
- :star: improved Timeline in logs: waterfall and other rules are visible

## 1.100.85 Development Latest
- :star: added taking screenshots in 'Test affiliate links'
- :sparkles: move logs to luminati_proxy_manager dir

## 1.99.679 Development Latest
- :star: changed SOCKS 5 port to be the same as main proxy port

## 1.99.85 Development Latest
- :star: removed hutil from dependency
- :star: added small cities for targeting
- :star: new feature in logs: select and resend

## 1.98.91 Development Latest
- :sparkles: new feature: Test affiliate links

## 1.98.63 Stable
- :star: added sending success rate info to luminati.io

## 1.97.753 Stable
- :bug: fixed memory leaks

## 1.97.739 Stable
- :bug: fixed selecting Carrier in Targeting

## 1.97.727 Development Latest
- :bug: fixed RegExp for url in Rules
- :bug: fixed memory leaks

## 1.97.122 Development Latest
- :star: new database with locations and ASNs
- :star: removed option "direct_exclude"
- :star: recent statistics are synced with dashboard in control panel
- :bug: fixed memory leak for waterfall

## 1.96.621 Stable
- :bug: lpm_install.sh: fix shasum for debian based systems

## 1.96.336 Stable
- :star: added global settings page
- :bug: fixed countries list for global shared zones

## 1.96.18 Stable
- :bug: lpm_install.sh: fixed issue with PATH in sudo

## 1.95.899 Stable

## 1.95.360 Stable
- :bug: fixed dialog on port conflict in electron app
- :bug: no version in exe name (for resident tasks)
- :star: HAR viewer improvements
- :bug: lpm_install.sh: fixed npm downgrade issue
- :bug: lpm_install.sh: fixed build_tools installation on non-debian systems

## 1.94.794 Stable
- :bug: fixed debug log info
- :bug: fixed targeting for certain cities

## 1.94.520 Stable

## 1.94.415 Development Latest
- :sparkles: HAR viewer improvements

## 1.93.910 
- :star: added support for HAR viewer in Firefox

## 1.93.813 
- :star: added new HAR viewer
- :bug: fixed setting max requests

## 1.93.58 
- :bug: Fixed memory leak introduced in latest versions
- :star: Added request_stats_limit flag to limit usage stats saved to sqite db (this will not affect ports with history: true)

## 1.92.822 
- :bug: fix saving RegExp in proxy configuration

## 1.92.281 
- :sparkles: UI improvements
- :star: compability with broken config files

## 1.92.212 
- :bug: fix port conflicts on starting the process

## 1.92.43 
- :star: improved performance of starting the process
- :sparkles: UI improvements

## 1.91.108 
- :sparkles: UI improvements
- :bug: bug fixes

## 1.90.563 
- :sparkles: UI improvements
- :bug: bug fixes

## 1.90.546 

## 1.90.506 

## 1.90.377 

## 1.89.371 
- :sparkles: new logs viewer
- :bug: fixed bugs related to socks5
- :bug: fixed reverse resolve bug
- :star: daemon mode improvements

## 1.88.679 
- :sparkles: add external proxies support
- :sparkles: UI improvements
- :sparkles: install script improvements
- :star: improved logging
- :star: allow tcp requests to 43 (whois) via socks and connect (only on zones with special permission)
- :bug: fixed proxy error handing and provide meaningful proxy errors
- :bug: fixed socks connection establish error handling
- :bug: fix https request to ip (will not be ssl analyzed)

## 1.88.182 
- :bug: fixed overload error on osx
- :sparkles: ui improvments

## 1.87.565 

## 1.86.979 
- :star: view response body in recent request log viewer
- :sparkles: stability fixes

## 1.86.25 
- :sparkles: improved upgrading on windwos binary
- :bug: allow google authentication token to be refreshed

## 1.85.660 
- :sparkles: multiple performance improvements in request pipeline

## 1.85.98 
- :sparkles: improved recent stats to show only user generated requests
- :bug: socks5 to work with multiply ports

## 1.84.634 
- :bug: fixed recent stats bandwidth calculations
- :sparkles: added links to messages in notification center

## 1.84.166 
- :star: added report a bug to easily get support

## 1.84.22 
- :sparkles: optimization improvments for linux/mac

## 1.83.446 
- :star: added banip api endpoint
- :sparkles: UI and bug fixing

## 1.81.930 
- :sparkles: improved configuration tab and added download option
- :sparkles: UI and bug fixing

## 1.81.318 
- :star: add min request time as rule trigger type
- :sparkles: improved multiply feature

## 1.80.942 
- :star: adding HAR view for request history
- :sparkles: UI and bug fixing

## 1.80.565 
- :bug: fix crash when enabling history
- :sparkles: improved view of request history
- :sparkles: polishing UI elements

## 1.80.111 
- :sparkles: improved bash installation script on Mac

## 1.79.834 
- :bug: fixed exe installer

## 1.79.778 
- :bug: proxy port with default zone
- :star: added 'carier' selector for mobile/residential
- :star: number of requests per port
- :star: bandwidth calculation per port

## 1.79.346 
- :bug: fixed socks5 for Firefox browser
- :sparkles: ui improvments

## 1.78.485 
- :star: onboarding flow for easier setup
- :sparkles: multiple ui improvments

## 1.77.943 
- :star: rule trigger 'max request time'
- :star: notification center
- :bug: add subjectAltName on certificate generation

## 1.77.506 
- :star: added proxy tester tool in main nav bar
- :sparkles: improved performance of edit and save proxies
- :bug: fixed request authorization feature

## 1.76.851 
- :star: add file log transport
- :bug: fix google bypass on selective dc zones
- :bug: fix whitelist IP to include localhost
- :sparkles: improvments in UI on proxies page and rules

## 1.76.363 
- :bug: fix multiply and duplicate port conflict
- :bug: fix reserved session timeout
- :sparkles: peformance improvments and UI for proxies page

## 1.75.912 
- :star: html body as a rule trigger
- :star: 'ban ip' as a rule action
- :star: 'reserved IP pool' as a rule action

## 1.75.443 
- :bug: fix session_duration 0 to disable session duration
- :star: 'waterfall' rule action to retry using different port

## 1.75.355 
- :star: added password and port fields to edit page
- :star: instant proxy duplication
- :bug: fix selection of boolean values in edit page

## 1.74.978 
- :star: remove git dependency
- :star: reserved session
- :star: new edit page design structure
- :star: new add proxy modal design

## 1.74.626 
- :star: add experimental cluster mode under '--cluster' flag in cmd
- :star: add race request option
- :star: add new rule action 'retry port'
- :bug: fix selection of mobile peers

## 1.72.729 

## 1.72.569 
- :star: improve log performance
- :star: fix exe link on windows

## 1.72.187 
- :star: added install script for Linux/MacOs installs
- :star: added option to create many ports from allocated ips

## 1.71.813 
- :star: published to npm
- :star: added 'how to use' page
- :star: improved onboarding flow

## 1.70.851 
- :bug: fixed upagrade issue from previous version

## 1.70.725 
- :star: new navbar layout
- :star: upgradable .exe version
- :star: improved ssl sniffing performance

## 1.70.323 
- :bug: bug fixes and ui improvments

## 1.70.145 
- :star: added option to view vip IP pool
- :star: added option to select specific vip per port
- :bug: fixed login bug
- :bug: fixed debug log info

## 1.69.565 
- :star: added new onboarding flow
- :star: added rotating User agent and cookies
- :bug: fixed multiple bugs and UI issues

## 1.68.880 
- :star: added export proxies list as CSV file
- :bug: fixed x-lpm-session header

## 1.68.476 
- :star: added dynamic presets
- :star: added timeout option to improve request performance
- :bug: ui and bug fixing

## 1.65.923 
- :star: added success rate counting
- :bug: multiple ui and bug fixing

## 1.64.509 
- :bug: fixed city selector

## 1.64.275 
- :star: improve proxy list ui

## 1.63.154 
- :star: improve stats ui
- :star: improve quick-start wizard ui

## 1.61.888 
- :bug: fix rule editing in proxy form when rules are undefined

## 1.61.772 
- :bug: fix proxy form when rules are set
- :bug: fix rule options not remembered in form
- :star: add reset rules button in proxy form
- :star: add rules form analytics
- :bug: fix analytics for input fields
- :bug: fix upgrade popup not firing in electron app

## 1.61.507 
- :star: release status code rule

## 1.61.96 
- :bug: fix 1mb limit on proxy configuration size
- :bug: fix broken save button in proxy form when rules present
- :star: add google analytics events on proxy edit modal
- :star: upgrade to new hutil version (fixes port handling in url globs)
- :star: allow setting rules per port

## 1.59.973 
- :star: remove internal browser and show terminal with log in exe
- :star: add disable_color flag to disable colors in terminal

## 1.58.884 
- :star: modify UI
- :bug: fix logging bug

## 1.58.632 
- :star: modify UI

## 1.57.967 
- :star: add file logging

## 1.57.488 
- :star: support custom urls for proxy status check

## 1.57.189 
- :bug: fix allocated ips

## 1.56.937 
- :bug: fix session handling with proxy-authorization header
- :star: add x-lpm-session header support

## 1.56.648 
- :bug: fix UI create proxy
- :star: added certificate setup instructions

## 1.56.452 
- :bug: fix typeerror when using rules

## 1.55.635 
- :star: added back button in stats
- :star: windows binary file show dialog on port conflicts

## 1.55.53 
- :bug: fixed high memory usage on high number of concurrent requests

## 1.54.526 
- :star: added reset stats button
- :bug: fixed memory leak in stats

## 1.53.605 
- :bug: fix UI css

## 1.52.848 
- :sparkles: add stats feature

## 1.52.425 
- :bug: fix google login

## 1.52.369 
- :bug: fix upgrade modal

## 1.52.241 
- :bug: fix allocated ips selection

## 1.52.1 
- :bug: fix login for renamed users
- :star: limit minimum values to numeric input fields

## 0.10.20 
- :star: added support for ip whitelist on each port
- :star: added analytics events on buttons and proxies
- :bug: fix reverse lookup for http

## 0.10.19 
- :star: added firewall ports tester in tools
- :bug: fix login problem for root users
- :bug: fix --iface parameter to accept ip addresses as well as interface names
- :bug: fix login for renamed customers

## 0.10.18 
- :star: added "--timeout" parameter
- :bug: fix login problem with some users
- :sparkles: speed and stability improvements
- :star: sessions are initialized on first request

## 0.10.17 
- :bug: fix keep default zone if enabled/available
- :sparkles: fix correct config proxy zones

## 0.10.16 
- :bug: fix memory leak
- :bug: fix dropin proxy select available zone, static by default

## 0.10.15 
- :bug: fix saving configuration from UI
- :bug: fix port conflicts crash
- :sparkles: stability improvements

## 0.10.14 
- :bug: fix "port": "auto" when no proxies are running
- :bug: fix permission "asn" check
- :sparkles: stability improvements

## 0.10.13 
- :bug: fix high cpu usage after multple UI reloads
- :star: added "port": "auto" option support to POST /api/proxies - auto selects next available port

## 0.10.12 
- :sparkles: fix manager crash on socks ECONNREFUSED ECONNRESET errors

## 0.10.11 
- :sparkles: further reduce load on lumtest
- :sparkles: reduce rate of /cp/lum_local_conf requests

## 0.10.10 
- :sparkles: reduce rate of lumtest requests

## 0.10.9 
- :sparkles: reduce rate of proxy check_credentials requests

## 0.10.8 
- :bug: fix infinite requests when luminati.io credentials are invalid

## 0.10.7 
- :star: added --cookie, --no-cookie options
- :bug: fix option to set Pool size from allocated IPs

## 0.10.6 
- :star: added smart rules scripting for zero-fail-rate (alpha)
- :bug: fixed Google account login

## 0.10.5 
- :bug: fixed fatal exception when zone has no passwords
- :bug: fixed inability to make POST requests with ssl analyzing
- :bug: resolved build failures on node v4

## 0.10.4 
- :star: update default zone passwords from luminati.io
- :sparkles: gather better stack traces during crashes
- :boom: force login when luminati.io credentials are out of date

## 0.10.2 
- :star: zone information is now always up-to-date with luminati.io
- :bug: whitelist, recent_ips, and stats no longer show empty lists
- :bug: zone password changes no longer old passwords in config files

## 0.10.1 
- :bug: removed spurious SOCKS error when using dropin proxy
- :bug: fixed errors encountered when giving password on the command line
- :bug: fixed compile errors on Node versions < 6

## 0.10.0 
- :star: made --dropin flag on by default
- :sparkles: apply proxy defaults late to avoid polluting configs with defaults
- :boom: report exception message when prereq check fails

## 0.9.75 
- :bug: avoid login error when customer=undefined
- :bug: enable login to work correctly when using --no-config
- :bug: ensure that proxies are correctly initialized in put/post
- :boom: remove inaccurate/confusing parameter reporting in UI
- :sparkles: slow down rate of requests to lumtest.com to reduce load

## 0.9.74 
- :bug: fixed issue with automating upgrading
- :star: made automatically saved config files shorter
- :bug: removed login issues when using --password on the command line

## 0.9.73 
- :bug: fixed --dropin to work correctly when credentials given on command line
- :star: made handling of command-line arguments work reliably

## 0.9.72 
- :bug: fixed event listener leak
- :bug: fixed usage of stringify in error reports
- :star: added additional analytics events
- :star: report location of config file during startup

## 0.9.69 
- :sparkles: added analytics events for understanding crashes

## 0.9.67 
- :sparkles: update API doc

## 0.9.66 
- :bug: fix API usage

## 0.9.65 
- :bug: fix startup on win

## 0.9.64 
- :star: added feature to set pool from allocated IPs
- :star: added feature to save history in external DB

## 0.9.63 
- :bug: tests failed with Node 5

## 0.9.62 
- :boom: move --resolve (manager level) to --reverse_lookup_file (proxy level)
- :sparkles: added --reverse_lookup_dns and --reverse_lookup_values options
- :sparkles: show allocated IPs for static plans

## 0.9.61 
- :sparkles: update REST api docs
- :sparkles: improve app stability

## 0.9.60 
- :bug: SOCKS now works with sticky_ip

## 0.9.59 
- :sparkles: use es6-shim

## 0.9.58 
- :sparkles: use indexOf instead of include to support old browsers

## 0.9.57 
- :sparkles: More correct usage message for docker users
- :sparkles: Add warning for proxy with history and no debug info
- :bug: History now show all pages
- :sparkles: Improve presets description, and make it more clear
- :star: Show session info for single session proxies
- :star: Random single session now support refresh_sessions, max_requests & session_duration

## 0.9.56 
- :sparkles: Improve app stability
- :bug: Remove empty country from the UI
- :bug: Allow editing of proxies with socks and multiply properly using dialog
- :sparkles: Add ability to dismiss upgrade (you can do upgrade from dropdown menu)

## 0.9.55 
- :bug: Explicit any country was not working properly
- :bug: Add countries that have no cities/states into UI
- :sparkles: Warn when keep_alive value is outside effective range 0-60
- :sparkles: Added alert for SSL connection to IP URLs
- :sparkles: Handle 404 URLs

## 0.9.54 
- :bug: Allow setting max requests from the UI

## 0.9.53 
- :bug: Allow windows and other OS to handle the large CSV file properly

## 0.9.52 
- :bug: Fix bug in loading of countries to UI

## 0.9.51 
- :sparkles: simplify handling of cities options in the UI
- :bug: Handle city names with spaces properly
- :bug: Treat zones with no plans proprly
- :sparkles: presets now show the values they set as disabled
- :boom: Clean up unused endpoint (/api/block)
- :bug: Treat resolve false as no resolve file and not as auto resolve

## 0.9.50 
- :sparkles: Support short_username for shorter credentials headers

## 0.9.49 
- :sparkles: Improve db handling
- :sparkles: Remove unnecesary warnings

## 0.9.48 
- :star: Improve proxy settings UI by presets
- :sparkles: show sticky sessions in the pool dialog
- :sparkles: Improve session editing (in form and inline)

## 0.9.47 
- :star: Detect config errors when saving config from UI
- :sparkles: UI improvements

## 0.9.46 
- :star: Allow defining multiple identical ports using the multiply property
- :sparkles: Link to FAX from inside the app

## 0.9.45 
- :bug: Obtain session info using protocol defined by --secure_proxy

## 0.9.44 
- :bug: Proxy field descriptions displayed wrong

## 0.9.43 
- :bug: Upgrade notification will display correctly

## 0.9.42 
- :sparkles: proxy API prevent port conflicts when saving proxy
- :boom: API changes move POST /delete to DELETE /proxies
- :bug: Upgrade message when no newer version is available
- :sparkles: Link to changelog in upgrade message

## 0.9.41 
- :star: make keep_alive support single session
- :sparkles: get last version using cdn

## 0.9.40 
- :sparkles: make --session visible in UI and CLI

## 0.9.39 
- :star: sticky_ip sessions now support keep_alive, max_requests and session_duration
- :sparkles: proxy inline form will prevent port conflicts when saving proxy

## 0.9.38 
- :star: FAQ now contain REST api documentation

## 0.9.37 
- :bug: drop in mode proxy use sticky_ip sessions and not pool sessions
- :bug: do not show alerts for lumtest.com requests
- :bug: avoid crashing when there is a new host for collecting stats

## 0.9.36 
- :star: refresh_sessions for sequential pools will only refresh the used session, and not all

## 0.9.35 
- :sparkles: Proxy settings dialog will prevent port conflicts when saving proxy

## 0.9.34 
- :bug: refresh_sessions now refresh sticky_ip sessions properly
- :sparkles: export history to CSV
- :star: Reintroducing direct_include/direct_exclude
- :sparkles: use pagination in proxies
- :sparkles: use pagination in pool

## 0.9.32 
- :sparkles: show history details below instead of modal
- :star: support stopping a running daemon using --stop-daemon
- :sparkles: use pagination in history details

## 0.9.31 
- :sparkles: Shuffle proxy hosts before using them, to spread traffic
- :bug: Avoid checking proper installation of optional dependencies

## 0.9.30 
- :star: Auto generate random seed for proxies, to avoid multiple instances share the same session
- :star: allow specifing seed for proxies to make them share the same IPs

## 0.9.29 
- :sparkles: use autocomplete for 'city' field in inline edit
- :bug: History can now be filtered by context

## 0.9.28 
- :sparkles: use autocomplete for 'city' field in proxy edit form

## 0.9.25 
- :sparkles: lock UI during upgrade
- :sparkles: use select for zone field in inline edit
- :sparkles: update tooltips
- :bug: show working URL for admin in case iface is used

## 0.9.24 
- :bug: Maintain HTTP header order and casing
- :sparkles: move 'add' and 'duplicate' buttons on top of the table

## 0.9.23 
- :sparkles: prevent memory leak warning for large pool_size
- :sparkles: prevent edit field if zone has no permissions for it
- :sparkles: improve layout of proxies table
- :sparkles: do not show not relevant errors

## 0.9.22 
- :sparkles: register IP in zone whitelist during login

## 0.9.21 
- :bug: login/logout issues

## 0.9.20 
- :bug: fix cases with Google sign-in with non-configured proxies

## 0.9.19 
- :sparkles: show proxy status details in next line
- :star: history now includes all requests made by proxy-manager for that proxy

## 0.9.18 
- :boom: `--direct_include` and `--direct_exclude` options have been removed; use `--bypass_proxy` instead (was restored on version 0.9.33)
- :sparkles: Use a drop-down to select the State/Province/Region in the proxies table, instead of free form text
- :bug: fix bug in saving history setting in UI
- :bug: fix request alerts on headers

## 0.9.16 
- :sparkles: use HTML tooltip for proxy status icon

## 0.9.15 
- :sparkles: show proxy status details in popup

## 0.9.14 
- :star: add X-Hola-Context header, that will not be passed over outside the manager, but will be added to the response and history
- :sparkles: improve checks for proxy saving
- :sparkles: visual changes for proxies table

## 0.9.13 
- :bug: handle gracefully old data table that do not exists
- :sparkles: delete zones from local DB after logout

## 0.9.12 
- :sparkles: improve tests

## 0.9.11 
- :sparkles: visual changes for login screen
- :bug: fix freezes of /proxies page

## 0.9.10 
- :sparkles: improve upgrade process

## 0.9.7 
- :bug: fix upgrade for Windows

## 0.9.6 
- :boom: remove experimental React version
- :bug: close HTTPS connection after "Refresh session" clicked to allow software to connect to new residential IP

## 0.9.5 
- :bug: Maintain the letter casing of the header names
- :star: improve upgrade process

## 0.9.4 
- :boom: Luminati Proxy Manager will now refuse to run on older versions of Node.js

## 0.9.3 
- :sparkles: delete credentials from config after logout

## 0.9.2 
- :sparkles: Allow installation for node 4 & 5 to allow upgrades to continue to work

## 0.9.1 
- :boom: Dropping support for node 4 & 5, please upgrade to node 6 or above

## 0.8.38 
- :sparkles: Use encoded creds instead of plain-text for Google OAuth login
- :sparkles: Move refresh and delete buttons to the top
- :sparkles: Update columns icon

## 0.8.37 
- :bug: Avoid crush if proxies have been deleted, while request comes in
- :sparkles: check proxy before saving to config file
- :boom: Force login in order to perform management operations through the UI

## 0.8.36 
- :bug: fix 25 null_response now filter by domain as well

## 0.8.35 
- :bug: delete proxies after logout

## 0.8.34 
- :sparkles: Improved proxy edit form

## 0.8.33 
- :sparkles: allow to select city w/o selected state
- :boom: delete credentials from config and stop proxies after log-out

## 0.8.32 
- :star: Replace text inputs for city and state by comboboxes
- :sparkles: Hide irrelevant fields
- :star: Proxy status UI and API

## 0.8.31 
- :sparkles: Separate "Default" and "Any" options for country
- :sparkles: Hide pool dialog for proxies that have no pool

## 0.8.30 
- :sparkles: Improved proxy edit form

## 0.8.29 
- :sparkles: Improved stability and reduces memory

## 0.8.28 
- :sparkles: Improve email login

## 0.8.27 
- :sparkles: Added warning on default zone change

## 0.8.26 
- :boom: Remove statistics

## 0.8.25 
- :sparkles: improve tests
- :sparkles: improve SSL load time

## 0.8.24 
- :star: Google login to luminati

## 0.8.23 
- :bug: history bug fix

## 0.8.22 
- :star: improved login message

## 0.8.21 
- :boom: drop-in proxy was changed to be disabled by default, and enabled only by the dropin cli argument or config value

## 0.8.20 
- :bug: fix pool_size 0 behavior and load proxy bug

## 0.8.19 
- :boom: you can now login with Luminati.io credentials

## 0.8.18 
- :boom: Removed core-dump support, can still be used when installed on the machine independently
- :boom: Setting max_requests, keep_alive or session_duration no longer automatically enable pool behaviors, you have to explicitly specify pool_size

## 0.8.17 
- :sparkles: Fixed laggy behavior of the proxies page when it has been open for a long time

## 0.8.16 
- :bug: bypass_proxy bug fix

## 0.8.15 
- :star: max_requests now support range - where each session gets a random max_request value in the range
- :sparkles: UI now allow define ranges for session_duration

## 0.8.14 
- :boom: Remove support for country specific super proxy (will use super proxy from any country if already configured for a specific country)
- :boom: Credential will be rechecked every hour and after every proxy modification

## 0.8.13 
- :star: Support core dump on crush using optional dependency in [core-dump](https://www.npmjs.com/package/core-dump) - removed on v0.8.18
- :bug: History bug fix

## 0.8.12 
- :star: Settings page replaced with login flow
- :boom: Removed /api/status API

## 0.8.11 
- :star: History can now be configured at the proxy level
- :sparkles: Warnings on saving proxy if there are any small issues with the settings

## 0.8.10 
- :sparkles: IP resolution file is now to be edited from the tools tab

## 0.8.9 
- :sparkles: Configuration file is now to be edited from the tools tab

## 0.8.5 
- :star: cache super-proxy IPs between runs in local DB
- :boom: /api/create endpoint was removed, the same functionality can be done   using a POST request to /api/proxies
- :sparkles: Improved tests

## 0.8.4 
- :bug: Fix SOCKS port handling in arguments and clone using UI

## 0.7.39 
- :boom: The web UI can now be run in normal and guest modes as well as in root mode (default)
- :sparkles: Improved tests
- :sparkles: Improved proxy error message

## 0.7.38 
- :bug: Handle password that contain special characters properly

## 0.7.37 
- :star: Column list in proxies overview is now configurable

## 0.7.34 
- :star: Added warning when enabling history with not SSL analyzing
- :sparkles: Added history alert for IP urls
- :sparkles: Add uninstall/install instructions to node upgrade notice

## 0.7.33 
- :bug: Specifying --socks port will not longer create conflict on the drop-in proxy
- :star: Notify on Auto IP resolution and warn about missing IP resolution when using SOCKs (#18)

## 0.7.32 
- :star: notification about recommended version of node (6+)
- :bug: obtain proxy peer IP & country for https requests from headers

## 0.7.31 
- :boom: secure_proxy can not be configured per proxy (like all other parameters) with command line giving advantage only over defaults settings
- :star: ssl analyzing can now be turned on/off individually for each proxy

## 0.7.30 
- :bug: Proxies with unavailable network interfaces no longer cause errors
- :bug: Default values for binary options are now working correctly

## 0.7.29 
- :star: User can now view IPs for accessing each proxy from outside of localhost
- :star: History backup archives are being removed after a month
- :bug: Kilobyte is now counted as 1000 bytes instead of 1024

## 0.7.28 
- :star: Request history archives can now be viewed along with the newer records
- :bug: History no longer crushes in case requests completes come before history initiation is complete

## 0.7.25 
- :star: Display and save the Proxy Peer IP in the history
- :star: Added bypass_proxy regexp for accessing assets directly
- :star: deamon mode using pm2
- :sparkles: Removed per-proxy local statistics to avoid discrepancies with the global statistics

## 0.7.24 
- :star: Archived request logs can now be viewed via the UI
- :sparkles: Displaying extra arguments in --no-config mode only

## 0.7.23 
- :star: IP resolution file can now be edited from within the UI
- :bug: "Delaying pool for 10 seconds" messages were shown even when the problem had been already resolved as well as after the application had been terminated

## 0.7.22 
- :bug: Session info was not displayed

## 0.7.21 
- :star: iOS certificate instructions in the FAQ
- :bug: Empty proxy settings are no longer stored in the configuration file

## 0.7.20 
- :sparkles: Moving the allow_proxy_auth from performance to IP policy
- :sparkles: Improve debug log

## 0.7.19 
- :bug: Credentials UI now works when using --no-config

## 0.7.18 
- :bug: :boom: Socks interface now listen only on selected interface
- :bug: Do not initiate and use more sessions then pool_size if refresh is hit multiple times
- :star: Logs now contain timestamp information

## 0.7.17 
- :bug: Semiautomatic upgrade fixed for Windows

## 0.7.16 
- :star: Default zone can now be changed
- :bug: Proxies info is now correctly updated on credentials change

## 0.7.15 
- :star: The application can now be updated semiautomatically via the UI

## 0.7.14 
- :star: Quick start wizard for beginner users

## 0.7.13 
- :star: Statistics on sessions from IP pool are now available
- :bug: Various minor bugs fixed

## 0.7.12 
- :star: Quicker credentials check

## 0.7.11 
- :star: IP pool for a given local proxy can now be viewed

## 0.7.10 
- :star: FAQ section added

## 0.7.9 
- :star: Sessions can now be refreshed from the UI/Rest without removing or changing proxy settings

## 0.7.7 
- :bug: Restarting is fixed under Windows

## 0.7.6 
- :star: Graceful shutdown from the UI and automatic restart on configuration change

## 0.7.5 
- :star: Configuration can be edited from within the UI

## 0.7.4 
- :star: UI Preselect available port for new proxy
- :star: nodejs API now does not have to be bound to a specific port

## 0.7.3 
- :star: History now stores body of each request
- :star: Requests from history can now be modified and replayed
- :star: Resettable statistics on local proxies

## 0.7.2 
- :star: Allow SSL connections/analyzing to insecure domains
- :bug: do not parse password as numbers even if format fit

## 0.7.1 
- :star: PhantomJS is now an optional dependency

## 0.7.0 
- :star: Major changes to the UI
- :star: Adding `keep_alive` support that keeps unused pool sessions alive

## 0.6.0 
- :boom: session_timeout was replaced by session_init_timeout, and its usints have been changed from milliseconds to seconds

## 0.5.2 
- :boom: SOCKS Interface can now be configured using UI and config files for each proxy

## 0.5.0 
- :boom: NodeJS api has changed its require method: from `require('luminati-proxy')` to `require('luminati-proxy').Luminati`

## 0.4.25 
- :boom: Null response for HTTPS connect requests return error code 501

## 0.4.24 
- :boom: Drop-in mode is now on by default

## 0.4.22 
- :boom: The rest api `/api/proxies` the `timeout` parameter was replaced by `idle_timeout`
- :boom: The cli & config parameter `timeout` was replaced by the `request_timeout`

## 0.2.0 
- :boom: Default proxy port was changed from `23000` to `24000`

## Legend
- :star: additional features
- :sparkles: improvements
- :bug: bug fixes
- :boom: breaking changes
