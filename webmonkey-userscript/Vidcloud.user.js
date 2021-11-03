// ==UserScript==
// @name         Vidcloud
// @description  Watch videos in external player.
// @version      1.0.5
// @match        *://vidembed.cc/*
// @match        *://*.vidembed.cc/*
// @match        *://vidnext.net/*
// @match        *://*.vidnext.net/*
// @match        *://vidcloud9.com/*
// @match        *://*.vidcloud9.com/*
// @match        *://vidclouds.icu/*
// @match        *://*.vidclouds.icu/*
// @match        *://vidnode.net/*
// @match        *://*.vidnode.net/*
// @icon         https://vidembed.cc/favicon.png
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
  "common": {
    "emulate_webmonkey":            false,

    "show_episode_list":            true,
    "sort_episode_list_ascending":  true,

    "poll_window_interval_ms":        500,
    "poll_window_timeout_ms":       30000
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// WebMonkey emulation may cause script to stop working in GreaseMonkey/TamperMonkey
// WebMonkey emulation is highly recommended when episode list presentation is enabled;
//   - otherwise the script runs in all frames and creates a race condition,
//     in which the first script to find a video URL wins
//   - when the winner occurs in an iframe,
//     the episode list presentation code doesn't find any episode list in the DOM,
//     and defaults to an immediate redirect to the video URL
//
// If the script does stop working in GreaseMonkey/TamperMonkey, either:
//   - comment the following line,
//     to preserve the race condition
//   - change common options to:
//      {emulate_webmonkey: false, show_episode_list: false}

user_options.common.emulate_webmonkey = user_options.common.emulate_webmonkey || user_options.common.show_episode_list

// ----------------------------------------------------------------------------- state

var state = {
  "current_window":                 null,
  "poll_window_timer":              null
}

// ----------------------------------------------------------------------------- retry until success or timeout occurs

var max_poll_window_attempts = Math.ceil(user_options.common.poll_window_timeout_ms / user_options.common.poll_window_interval_ms)

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
        user_options.common.poll_window_interval_ms
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
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

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
      url = GM_resolveUrl(url, state.current_window.location.href) || url

    GM_loadUrl(url, 'Referer', state.current_window.location.href)
  }
  else {
    try {
      state.current_window = unsafeWindow.top
      state.current_window.location = url
    }
    catch(e) {
      state.current_window = unsafeWindow.window
      state.current_window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, referer_url) {
  clear_poll_window_timer()

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser
    GM_startIntent(/* action= */ 'android.intent.action.VIEW', /* data= */ video_url, /* type= */ video_type, /* extras: */ 'referUrl', referer_url)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website
    redirect_to_url(get_webcast_reloaded_url(video_url, /* vtt_url= */ null, referer_url))
    return true
  }
  else {
    return false
  }
}

// ----------------------------------------------------------------------------- conditionally rewrite DOM in current window

var sort_episode_list_ascending = function($ul) {
  // assumption: default sort order of list is [most-recent ... oldest]

  var $li_all = $ul.querySelectorAll(':scope > li.video-block')

  while ($ul.childNodes.length) {
    $ul.removeChild($ul.childNodes[0])
  }

  for (var i=($li_all.length - 1); i >= 0; i--) {
    $ul.appendChild($li_all[i])
  }
}

var add_label_current = function($link_current) {
  var $label = unsafeWindow.document.createElement('span')

  $label.style.position        = 'absolute'
  $label.style.bottom          = '0'
  $label.style.right           = '0'
  $label.style.backgroundColor = '#2ba9a5'
  $label.style.color           = '#ffffff'
  $label.style.padding         = '4px 10px'
  $label.innerHTML             = 'Current Episode'

  $link_current.appendChild($label)
}

var add_process_video_onclick_handler = function($link_current, video_url, video_type, referer_url) {
  // onclick handler:
  //   - in WebMonkey, start Intent
  //   - in GreaseMonkey/TamperMonkey, redirect page
  $link_current.onclick = function(event) {
    event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;

    process_video_url(video_url, video_type, referer_url)
  }

  // change link for current episode to WebcastReloaded website:
  // - in GreaseMonkey/TamperMonkey, user can manually choose to open website in a new tab..
  //   which keeps the current tab open w/ its list of available episodes
  $link_current.setAttribute('href', get_webcast_reloaded_url(video_url, /* vtt_url= */ null, referer_url))
}

var remove_playicon_overlay = function($link_current, $links_all) {
  var $link, $overlay

  for (var i=0; i < $links_all.length; i++) {
    $link = $links_all[i]

    if ($link === $link_current)
      continue

    $overlay = $link.querySelector(':scope > div.img > div.hover_watch')
    if ($overlay) {
      $overlay.style.display = 'none'
    }
  }
}

var preprocess_video_url = function(video_url, video_type, referer_url) {
  clear_poll_window_timer()

  var has_episodes, $ul, $body, $link_current, $links_all

  has_episodes = false

  $ul = unsafeWindow.document.querySelector('div.main-content > div.video-info > div.video-info-left > ul.items')
  if ($ul && ($ul.querySelectorAll(':scope > li.video-block').length > 1)) {
    has_episodes = true

    $body = unsafeWindow.document.body
    while ($body.childNodes.length) {
      $body.removeChild($body.childNodes[0])
    }
    $body.appendChild($ul)

    if (user_options.common.sort_episode_list_ascending)
      sort_episode_list_ascending($ul)

    $link_current = $ul.querySelector(':scope > li.video-block > a[href="' + unsafeWindow.location.pathname + '"]')
    if ($link_current) {
      add_label_current($link_current)
      add_process_video_onclick_handler($link_current, video_url, video_type, referer_url)

      $links_all = $ul.querySelectorAll(':scope > li.video-block > a[href]')
      remove_playicon_overlay($link_current, $links_all)
    }
  }

  if (has_episodes)
    user_options.webmonkey.post_intent_redirect_to_url = null
  else
    process_video_url(video_url, video_type, referer_url)
}

// ----------------------------------------------------------------------------- find iframe in current window

var get_iframe_element = function() {
  var win = state.current_window
  var iframe

  iframe = win.document.querySelector('#the_frame > iframe')
  if (iframe) return iframe

  iframe = win.document.querySelector('.watch_play > .play-video > iframe')
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
  var the_player, config, source, video_url, video_type, referer_url
  var iframe_content, delay_ms

  if (
       state.current_window.jwplayer
    && ('function' === (typeof state.current_window.jwplayer))
  ) {
    // process jwplayer playlist sources

    the_player = state.current_window.jwplayer()

    if (
         the_player
      && ('object'   === (typeof the_player))
      && ('function' === (typeof the_player.getConfig))
    ) {
      config = the_player.getConfig()

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

          if (user_options.common.show_episode_list)
            preprocess_video_url(video_url, video_type, referer_url)
          else
            process_video_url(video_url, video_type, referer_url)

          return true
        }
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
  if (user_options.common.emulate_webmonkey && (unsafeWindow.top !== unsafeWindow.window)) return

  if (state.current_window !== null) return

  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  state.current_window    = unsafeWindow.window
  state.poll_window_timer = 0

  unsafeWindow.onbeforeunload = clear_poll_window_timer

  delay_poll_window(process_current_window, 0)
}

setTimeout(init, 50)

// -----------------------------------------------------------------------------
