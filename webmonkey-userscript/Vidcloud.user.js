// ==UserScript==
// @name         Vidcloud
// @description  Watch videos in external player.
// @version      1.0.0
// @match        *://vidnext.net/*
// @match        *://*.vidnext.net/*
// @match        *://vidcloud9.com/*
// @match        *://*.vidcloud9.com/*
// @match        *://vidclouds.icu/*
// @match        *://*.vidclouds.icu/*
// @match        *://vidnode.net/*
// @match        *://*.vidnode.net/*
// @icon         https://vidnext.net/favicon.png
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-Vidcloud/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-Vidcloud/issues
// @downloadURL  https://github.com/warren-bank/crx-Vidcloud/raw/webmonkey-userscript/es5/webmonkey-userscript/Vidcloud.user.js
// @updateURL    https://github.com/warren-bank/crx-Vidcloud/raw/webmonkey-userscript/es5/webmonkey-userscript/Vidcloud.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "poll_window_interval_ms":        500,
  "poll_window_timeout_ms":       30000,

  "redirect_to_webcast_reloaded": true,
  "force_http":                   true,
  "force_https":                  false,

  "emulate_webmonkey":            true
}

// ----------------------------------------------------------------------------- state

var state = {
  "current_window":               null,
  "poll_window_timer":            null
}

// ----------------------------------------------------------------------------- retry until success or timeout occurs

var max_poll_window_attempts = Math.ceil(user_options.poll_window_timeout_ms / user_options.poll_window_interval_ms)

var clear_poll_window_timer = function() {
  if (!state.poll_window_timer) return

  unsafeWindow.clearTimeout(state.poll_window_timer)
  state.poll_window_timer = 0
}

var poll_window = function(process_window, count_poll_window_attempts) {
  if (!count_poll_window_attempts)
    count_poll_window_attempts = 0

  count_poll_window_attempts++

  if (count_poll_window_attempts <= max_poll_window_attempts) {
    if (!process_window()) {
      state.poll_window_timer = unsafeWindow.setTimeout(
        function() {
          clear_poll_window_timer()

          poll_window(process_window, count_poll_window_attempts)
        },
        user_options.poll_window_interval_ms
      )
    }
  }
}

var delay_poll_window = function(process_window, delay_ms) {
  clear_poll_window_timer()

  if (!delay_ms)
    delay_ms = 0

  state.poll_window_timer = unsafeWindow.setTimeout(
    function() {
      clear_poll_window_timer()

      poll_window(process_window)
    },
    delay_ms
  )
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  clear_poll_window_timer()

  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, state.current_window.location.href)

    GM_loadUrl(url, 'Referer', state.current_window.location.href)
  }
  else {
    try {
      state.current_window = unsafeWindow.top
      state.current_window.location = url
    }
    catch(e) {
      state.current_window = unsafeWindow
      state.current_window.location = url
    }
  }
}

var process_video_url = function(video_url, video_type, referer_url) {
  clear_poll_window_timer()

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser
    GM_startIntent(/* action= */ 'android.intent.action.VIEW', /* data= */ video_url, /* type= */ video_type, /* extras: */ 'referUrl', referer_url)
    return true
  }
  else if (user_options.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website
    redirect_to_url(get_webcast_reloaded_url(video_url, /* vtt_url= */ null, referer_url))
    return true
  }
  else {
    return false
  }
}

// ----------------------------------------------------------------------------- find iframe in current window

var get_iframe_element = function() {
  var win = state.current_window
  var iframe

  iframe = win.document.querySelector('#the_frame > iframe')
  if (iframe) return iframe

  iframe = win.document.querySelector('iframe[allowfullscreen="yes"]')
  if (iframe) return iframe

  iframe = win.document.querySelector('iframe')
  if (iframe) return iframe

  return null
}

var get_iframe_content = function() {
  var win = state.current_window
  var iframe, if_src, if_win, if_doc, if_href

  try {
    if (!win) throw ''

    iframe = get_iframe_element(win)
    if (!iframe) throw ''

    if_src = iframe.getAttribute('src')
    if (!if_src) throw ''
    if (if_src === 'about:blank') throw ''

    if_win = iframe.contentWindow
    if (!if_win) throw ''

    if_doc = if_win.document
    if (!if_doc) throw ''

    if_href = if_win.location.href
    if (!if_href) throw ''
    if (if_href === 'about:blank') throw ''

    return {"window": if_win, "document": if_doc, "src": if_src, "href": if_href}
  }
  catch(e) {
    if (e !== '') {
      // cross-origin: redirect top window to load iframe src
      redirect_to_url(if_href || if_src)
    }

    return null
  }
}

// ----------------------------------------------------------------------------- process current window

var process_current_window = function() {
  var config, source, video_url, video_type, referer_url
  var iframe_content, delay_ms

  if (
       state.current_window.jwplayer
    && ('function' === (typeof state.current_window.jwplayer))
  ) {
    // process jwplayer playlist sources

    config = state.current_window.jwplayer().getConfig()

    if (
         config && ('object' === (typeof config))
      && config.sources && Array.isArray(config.sources) && config.sources.length
    ) {
      for (var i=0; i < config.sources.length; i++) {
        source = config.sources[i]
        if (!source.file) continue

        video_url  = source.file + ((source.type) ? ('#video.' + source.type) : '')
        video_type = (source.type) ? ('video/' + source.type) : null
        break
      }

      if (video_url) {
        referer_url = state.current_window.location.href || unsafeWindow.location.href
        process_video_url(video_url, video_type, referer_url)
        return true
      }
    }
  }

  iframe_content = get_iframe_content()
  if (iframe_content) {
    // process nested iframe

    state.current_window = iframe_content.window

    delay_ms = 0
    delay_poll_window(process_current_window, delay_ms)
    return true
  }

  // retry after delay
  return false
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  if (user_options.emulate_webmonkey && (unsafeWindow.top !== unsafeWindow)) return

  if (state.current_window !== null) return

  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  state.current_window    = unsafeWindow
  state.poll_window_timer = 0

  unsafeWindow.onbeforeunload = clear_poll_window_timer

  delay_poll_window(process_current_window, 0)
}

setTimeout(init, 50)

// -----------------------------------------------------------------------------
