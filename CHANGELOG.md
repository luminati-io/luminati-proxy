# Luminati Proxy manager - Change Log

- v0.7.21
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
