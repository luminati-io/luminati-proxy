# Luminati Proxy manager - Change Log

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

