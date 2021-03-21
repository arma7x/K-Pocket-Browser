"use strict";var _typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol?"symbol":typeof e},REGEXPS={unlikelyCandidates:/-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,okMaybeItsACandidate:/and|article|body|column|content|main|shadow/i};function isNodeVisible(e){return(!e.style||"none"!=e.style.display)&&!e.hasAttribute("hidden")&&(!e.hasAttribute("aria-hidden")||"true"!=e.getAttribute("aria-hidden")||e.className&&e.className.indexOf&&-1!==e.className.indexOf("fallback-image"))}function isProbablyReaderable(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1];"function"==typeof t&&(t={visibilityChecker:t});var n={minScore:20,minContentLength:140,visibilityChecker:isNodeVisible};t=Object.assign(n,t);var r=e.querySelectorAll("p, pre"),i=e.querySelectorAll("div > br");if(i.length){var a=new Set(r);[].forEach.call(i,function(e){a.add(e.parentNode)}),r=Array.from(a)}var o=0;return[].some.call(r,function(e){if(!t.visibilityChecker(e))return!1;var n=e.className+" "+e.id;if(REGEXPS.unlikelyCandidates.test(n)&&!REGEXPS.okMaybeItsACandidate.test(n))return!1;if(e.matches("li p"))return!1;var r=e.textContent.trim().length;return!(r<t.minContentLength)&&(o+=Math.sqrt(r-t.minContentLength))>t.minScore})}"object"===("undefined"==typeof module?"undefined":_typeof(module))&&(module.exports=isProbablyReaderable);
