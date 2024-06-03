var s = document.createElement('script');
s.src = chrome.runtime.getURL('contentScript.bundle.js');
s.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(s);

console.debug("Injected contentScript.bundle.js")