(function (window) {

  'use strict';

  /**
   * Returns an iframe which runs in a child process with Browser API enabled
   * and fullscreen is allowed
   *
   * @param  {String} url Optional URL
   * @return {iframe}     An OOP mozbrowser iframe
   */
  function createIFrame (url) {
    var iframe = document.createElement('iframe');
    iframe.setAttribute('mozbrowser', true);
    iframe.setAttribute('mozallowfullscreen', true);
    iframe.setAttribute('remote', true);

    if (url) {
      iframe.src = url;
    }

    return iframe;
  }

  /**
   * The browser tab constructor.
   *
   * Creates an iframe and attaches mozbrowser events for web browsing.
   *
   * Implements EventListener Interface.
   *
   * @param {String} url An optional plaintext URL
   */
  function Tab (url) {
    this.iframe = createIFrame(url);
    this.title = null;
    this.url = url;

    this.iframe.addEventListener('mozbrowserloadstart', this);
    this.iframe.addEventListener('mozbrowserlocationchange', this);
    this.iframe.addEventListener('mozbrowsertitlechange', this);
    this.iframe.addEventListener('mozbrowserloadend', this);
    this.iframe.addEventListener('mozbrowsererror', this);
  };

  /**
   * Handle mozbrowser events and call specific event handler accordingly.
   *
   * Implements EventListener handleEvent method.
   * http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-EventListener
   */
  Tab.prototype.handleEvent = function _handleEvent (e) {
    this[e.type](e);
  };

  /**
   * The mozbrowserloadstart event handler. Dispatch a CustomEvent
   * 'tab:loadstart' with this Tab as event detail.
   */
  Tab.prototype.mozbrowserloadstart = function _mozbrowserloadstart (e) {
    var event = new CustomEvent('tab:loadstart', { detail: this });
    window.dispatchEvent(event);
    this.iframe.blur();
  };

  Tab.prototype.mozbrowserlocationchange = function _mozbrowserlocationchange (e) {
    this.url = e.detail;
    this.title = e.detail;
    var event = new CustomEvent('tab:locationchange', { detail: this });
    window.dispatchEvent(event);
    this.iframe.blur();
  };

  Tab.prototype.mozbrowsertitlechange = function _mozbrowsertitlechange (e) {
    if (e.detail) {
      this.title = e.detail;
    }
    var event = new CustomEvent('tab:titlechange', { detail: this });
    window.dispatchEvent(event);
    this.iframe.blur();
  };

  Tab.prototype.mozbrowserloadend = function _mozbrowserloadend (e) {
    var event = new CustomEvent('tab:loadend', { detail: this });
    window.dispatchEvent(event);
    this.iframe.blur();
  };

  Tab.prototype.mozbrowsererror = function _mozbrowsererror (e) {
    var event = new CustomEvent('tab:error', { detail: this });
    window.dispatchEvent(event);
    this.iframe.blur();
  };

  /**
   * Change the visibility state of the tab.
   * @param {Boolean} isVisible isVisible
   */
  Tab.prototype.setVisible = function _setVisible (isVisible) {
    this.iframe.setVisible(isVisible);
  };

  /**
   * Browse the URL.
   *
   * @param  {[type]} url URL
   */
  Tab.prototype.goToUrl = function _goToUrl (url) {
    this.iframe.src = url;
    this.title = url;
    this.url = url;
  };

  /**
   * Go back to the previous location in the navigation history.
   */
  Tab.prototype.goBack = function _goBack () {
    this.iframe.goBack();
  };

  /**
   * Go back to the next location in the navigation history.
   */
  Tab.prototype.goForward = function _goForward () {
    this.iframe.goForward();
  };

  /**
   * Reload the current page.
   */
  Tab.prototype.reload = function _reload () {
    this.iframe.reload();
  };

  /**
   * Check if the iframe can go backward in the navigation history.
   *
   * @return {Promise} Resolve with true if it can go backward.
   */
  Tab.prototype.getCanGoBack = function _getCanGoBack () {
    var self = this;

    return new Promise(function (resolve, reject) {
      var request = self.iframe.getCanGoBack();

      request.onsuccess = function () {
        if (this.result) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
    });
  };

  /**
   * Check if the iframe can go forward in the navigation history.
   *
   * @return {Promise} Resolve with true if it can go forward.
   */
  Tab.prototype.getCanGoForward = function _getCanGoForward () {
    var self = this;

    return new Promise(function (resolve, reject) {
      var request = self.iframe.getCanGoForward();

      request.onsuccess = function () {
        if (this.result) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
    });
  };

  window.Tab = Tab;

})(window);
