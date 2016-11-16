# Luminati Proxy manager - Change Log

- v0.8.19
  - :boom: You can now login with Luminati.io credentials
- v0.8.18
  - :boom: Removed core-dump support, can still be used when installed on the
    machine independently
  - :boom: Setting max_requests, keep_alive or session_duration no longer
    automatically enable pool behaviors, you have to explicitly specify
    pool_size
- v0.8.17
  - :sparkles: Fixed laggy behavior of the proxies page when it has been open
    for a long time
- v0.8.16
  - :bug: bypass_proxy bug fix
- v0.8.15
  - :star: max_requests now support range - where each session gets a random
    max_request value in the range
  - :sparkles: UI now allow define ranges for session_ducation
- v0.8.14
  - :boom: Remove support for country specific super proxy (will use super
    proxy from any country if already configured for a specific country)
  - :boom: Credential will be rechecked every hour and after every proxy
    modification
- v0.8.13
  - :star: Support core dump on crush using optional dependency in
    [core-dump](https://www.npmjs.com/package/core-dump) - removed on v0.8.18
  - :bug: History bug fix
- v0.8.12
  - :star: Settings page replaced with login flow
  - :boom: Removed /api/status API
- v0.8.11
  - :star: History can now be configured at the proxy level
  - :sparkles: Warnings on saving proxy if there are any small issues with the
    settings
- v0.8.10
  - :sparkles: IP resolution file is now to be edited from the tools tab
- v0.8.9
  - :sparkles: Configuration file is now to be edited from the tools tab
- v0.8.5
  - :star: cache super-proxy IPs between runs in local DB
  - :boom: /api/create endpoint was removed, the same functionality can be done   using a POST request to /api/proxies
  - :sparkles: Improved tests
- v0.8.4
  - :bug: Fix SOCKS port handling in arguments and clone using UI
- v0.7.39
  - :boom: The web UI can now be run in normal and guest modes as well as in
  root mode (default)
  - :sparkles: Improved tests
  - :sparkles: Improved proxy error message
- v0.7.38
  - :bug: Handle password that contain special characters properly
- v0.7.37
  - :star: Column list in proxies overview is now configurable
- v0.7.34
  - :star: Added warning when enabling history with not SSL sniffing
  - :sparkles: Added history alert for IP urls
  - :sparkles: Add uninstall/install instructions to node upgrade notice
- v0.7.33
  - :bug: Specifying --socks port will not longer create conflict on the
    drop-in proxy
  - :star: Notify on Auto IP resolution and warn about missing IP resolution
    when using SOCKs (#18)
- v0.7.32
  - :star: notification about recommended version of node (6+)
  - :bug: obtain proxy peer IP & country for https requests from headers
- v0.7.31
  - :boom: secure_proxy can not be configured per proxy (like all other
  parameters) with command line giving advantage only over defaults settings
  - :star: ssl sniffing can now be turned on/off individually for each proxy
- v0.7.30
  - :bug: Proxies with unavailable network interfaces no longer cause errors
  - :bug: Default values for binary options are now working correctly
- v0.7.29
  - :star: User can now view IPs for accessing each proxy from outside of
  localhost
  - :star: History backup archives are being removed after a month
  - :bug: Kilobyte is now counted as 1000 bytes instead of 1024
- v0.7.28
  - :star: Request history archives can now be viewed along with the newer
  records
  - :bug: History no longer crushes in case requests completes come before
  history initiation is complete
- v0.7.25
  - :star: Display and save the Proxy Peer IP in the history
  - :star: Added bypass_proxy regexp for accessing assets directly
  - :star: deamon mode using pm2
  - :sparkles: Removed per-proxy local statistics to avoid discrepancies with
  the global statistics
- v0.7.24
  - :star: Archived request logs can now be viewed via the UI
  - :sparkles: Displaying extra arguments in --no-config mode only
- v0.7.23
  - :star: IP resolution file can now be edited from within the UI
  - :bug: "Delaying pool for 10 seconds" messages were shown even when the
  problem had been already resolved as well as after the application had been
  terminated
- v0.7.22
  - :bug: Session info was not displayed
- v0.7.21
  - :star: iOS certificate instructions in the FAQ
  - :bug: Empty proxy settings are no longer stored in the configuration file
- v0.7.20
  - :sparkles: Moving the allow_proxy_auth from performance to IP policy
  - :sparkles: Improve debug log
- v0.7.19
  - :bug: Credentials UI now works when using --no-config
- v0.7.18
  - :bug: :boom: Socks interface now listen only on selected interface
  - :bug: Do not initiate and use more sessions then pool_size if refresh is
  hit multiple times
  - :star: Logs now contain timestamp information
- v0.7.17
  - :bug: Semiautomatic upgrade fixed for Windows
- v0.7.16
  - :star: Default zone can now be changed
  - :bug: Proxies info is now correctly updated on credentials change
- v0.7.15
  - :star: The application can now be updated semiautomatically via the UI
- v0.7.14
  - :star: Quick start wizard for beginner users
- v0.7.13
  - :star: Statistics on sessions from IP pool are now available
  - :bug: Various minor bugs fixed
- v0.7.12
  - :star: Quicker credentials check
- v0.7.11
  - :star: IP pool for a given local proxy can now be viewed
- v0.7.10
  - :star: FAQ section added
- v0.7.9
  - :star: Sessions can now be refreshed from the UI/Rest without removing or
  changing proxy settings
- v0.7.7
  - :bug: Restarting is fixed under Windows
- v0.7.6
  - :star: Graceful shutdown from the UI and automatic restart on configuration
  change
- v0.7.5
  - :star: Configuration can be edited from within the UI
- v0.7.4
  - :star: UI Preselect avaliable port for new proxy
  - :star: nodejs API now does not have to be bound to a specific port
- v0.7.3
  - :star: History now stores body of each request
  - :star: Requests from history can now be modified and replayed
  - :star: Resettable statistics on local proxies
- v0.7.2
  - :star: Allow SSL connections/sniffing to insecure domains
  - :bug: do not parse password as numbers even if format fit
- v0.7.1
  - :star: PhantomJS is now an optional dependency
- v0.7.0
  - :star: Major changes to the UI
  - :star: Adding `keep_alive` support that keeps unused pool sessions alive
- v0.6.0
  - :boom: session_timeout was replaced by session_init_timeout, and its usints
  have been changed from milliseconds to seconds
- v0.5.2
  - :boom: SOCKS Interface can now be configured using UI and config files for
  each proxy
- v0.5.0
  - :boom: NodeJS api has changed its require method: from
  `require('luminati-proxy')` to `require('luminati-proxy').Luminati`
- v0.4.25
  - :boom: Null response for HTTPS connect requests return error code 501
- v0.4.24
  - :boom: Drop-in mode is now on by default
- v0.4.22
  - :boom: The rest api `/api/proxies` the `timeout` parameter was replaced by
  `idle_timeout`
  - :boom: The cli & config parameter `timeout` was replaced by the
  `request_timeout`
- v0.2.0
  - :boom: Default proxy port was changed from `23000` to `24000`

## Legend

- :star: additional features
- :sparkles: improvements
- :bug: bug fixes
- :boom: breaking changes

