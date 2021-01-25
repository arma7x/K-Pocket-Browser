window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const CONSUMER_KEY = "94872-b408e0508baaa3a6658564f3";
  const COUNT = 24;
  var IFRAME_TIMER;

  const state = new KaiState({
    'redirect_url': '',
    'editor': '',
  });

  const getPocketApi = function(ACCESS_TOKEN, type, config = {}) {
    return new Promise((resolve, reject) => {
      var URL;
      if (type === 'ADD') {
        URL = 'https://getpocket.com/v3/add';
      } else if (type === 'UPDATE') {
        URL = 'https://getpocket.com/v3/send';
      } else if (type === 'GET') {
        URL = 'https://getpocket.com/v3/get';
      }
      var request = new XMLHttpRequest({ mozSystem: true });
      var params = {
        "consumer_key": CONSUMER_KEY,
        "access_token": ACCESS_TOKEN
      };
      params = Object.assign(params, config);
      request.open('POST', URL, true);
      request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      request.setRequestHeader("X-Accept", 'application/json');
      request.onreadystatechange = () => {
        if(request.readyState == 4) {
          try {
            const response = JSON.parse(request.response);
            if (request.response && request.status == 200) {
              resolve({ raw: request, response: response});
            } else {
              reject({ raw: request, response: response});
            }
          } catch (e) {
            if (request.response && request.status == 200) {
              resolve({ raw: request, response: request.response});
            } else {
              reject({ raw: request, response: request.response});
            }
          }
        }
      }
      request.send(JSON.stringify(params));
    });
  }

  const loginPage = function($router) {
    var REQUEST_TOKEN;
    var oauthRequest = new XMLHttpRequest({ mozSystem: true });
    var params = {
      "consumer_key": CONSUMER_KEY,
      "redirect_uri": "https://getpocket.com/about"
    };
    oauthRequest.open('POST', 'https://getpocket.com/v3/oauth/request', true);
    oauthRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    oauthRequest.setRequestHeader("X-Accept", 'application/json');
    oauthRequest.onreadystatechange = function() {
      if(oauthRequest.readyState == 4 && oauthRequest.status == 200) {
        $router.hideLoading();
        if (oauthRequest.response) {
          var obj = JSON.parse(oauthRequest.response);
          REQUEST_TOKEN = obj.code;
          var url = `https://getpocket.com/auth/authorize?request_token=${obj.code}&redirect_uri=${params.redirect_uri}&mobile=1`
          $router.push(new Kai({
            name: 'loginPage',
            data: {
              title: 'loginPage'
            },
            templateUrl: document.location.origin + '/templates/login.html',
            mounted: function() {
              const hdr = document.getElementById('__kai_header__');
              hdr.classList.add("sr-only");
              const sk = document.getElementById('__kai_soft_key__');
              sk.classList.add("sr-only");
              const kr = document.getElementById('__kai_router__');
              kr.classList.add("full-screen-browser");
              console.log('mount browser');
              navigator.spatialNavigationEnabled = true;
              var frameContainer = document.getElementById('login-container');
              currentTab = new Tab(url);
              currentTab.iframe.setAttribute('height', '296px;');
              currentTab.iframe.setAttribute('frameBorder', '0');
              var container = document.querySelector('#login-container'); //browser-iframe
              var root1 = container.createShadowRoot();
              var root2 = container.createShadowRoot();
              root1.appendChild(currentTab.iframe);
              var shadow = document.createElement('shadow');
              root2.appendChild(shadow);
              currentTab.iframe.addEventListener('mozbrowserlocationchange', function (e) {
                if (e.detail.url === 'app://kpocket.arma7x.com/success.html') {
                  console.log("REQUEST_TOKEN", REQUEST_TOKEN);
                  var oauthAuthorize = new XMLHttpRequest({ mozSystem: true });
                  var params = {
                    "consumer_key": CONSUMER_KEY,
                    "code": REQUEST_TOKEN
                  };
                  oauthAuthorize.open('POST', 'https://getpocket.com/v3/oauth/authorize', true);
                  oauthAuthorize.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                  oauthAuthorize.setRequestHeader("X-Accept", 'application/json');
                  oauthAuthorize.onreadystatechange = function() {
                    if(oauthAuthorize.readyState == 4 && oauthAuthorize.status == 200) {
                      if (oauthAuthorize.response) {
                        var obj = JSON.parse(oauthAuthorize.response);
                        localforage.setItem('POCKET_ACCESS_TOKEN', obj)
                        .then((res) => {
                          $router.showToast('Successfully login');
                          console.log(res);
                        })
                        .catch((err) => {
                          $router.showToast('Error saving token');
                          console.log(err);
                        })
                        .finally(() => {
                          $router.pop();
                        });
                      } else {
                        console.log(http);
                        $router.showToast('Invalid response');
                        $router.pop();
                      }
                    } else if (oauthAuthorize.status == 403) {
                      console.log(oauthAuthorize.status);
                      $router.showToast('Unauthorize 403');
                      $router.pop();
                    } else {
                      $router.showToast('Unknown Error');
                      $router.pop();
                    }
                  }
                  oauthAuthorize.send(JSON.stringify(params));
                }
              });
            },
            unmounted: function() {
              const hdr = document.getElementById('__kai_header__');
              hdr.classList.remove("sr-only");
              const sk = document.getElementById('__kai_soft_key__');
              sk.classList.remove("sr-only");
              const kr = document.getElementById('__kai_router__');
              kr.classList.remove("full-screen-browser");
              navigator.spatialNavigationEnabled = false;
            },
            methods: {
              listenState: function() {}
            },
            softKeyText: { left: '', center: '', right: '' },
            softKeyListener: {
              left: function() {},
              center: function() {},
              right: function() {}
            },
            backKeyListener: function() {}
          }));
        } else {
          console.log(oauthRequest);
        }
      } else {
        $router.hideLoading();
        console.log(oauthRequest);
      }
    }
    $router.showLoading();
    oauthRequest.send(JSON.stringify(params));
  }

  const browser = new Kai({
    name: 'browser',
    data: {
      title: 'browser',
      loading: false,
    },
    templateUrl: document.location.origin + '/templates/browser.html',
    mounted: function() {
      const sk = document.getElementById('__kai_soft_key__');
      sk.classList.add("sr-only");
      const kr = document.getElementById('__kai_router__');
      kr.classList.add("full-screen-browser");
      console.log('mount browser');
      navigator.spatialNavigationEnabled = true;
      var frameContainer = document.getElementById('browser-iframe');
      var root = frameContainer.createShadowRoot();
      currentTab = new Tab('https://www.google.com/');
      currentTab.iframe.setAttribute('height', '266px;');
      currentTab.iframe.setAttribute('frameBorder', '0');
      currentTab.iframe.addEventListener('mozbrowserlocationchange', (e) => {
        this.$state.setState('redirect_url', e.detail.url);
        this.$router.setHeaderTitle(e.detail.url);
      });
      currentTab.iframe.addEventListener('mozbrowsercontextmenu', (event) => {
        if (document.activeElement.tagName === 'IFRAME') {
          document.activeElement.blur();
          console.log('remove OPTIONS sr-only & add DONE sr-only')
          document.getElementById('search-menu').classList.remove('sr-only');
          document.getElementById('option-menu').classList.remove('sr-only');
          document.getElementById('done-btn').classList.add('sr-only');
        } else {
          window['currentTab'].getCanGoBack()
          .then((canBack) => {
            return Promise.resolve({canBack: canBack});
          })
          .then((menu) => {
            return window['currentTab'].getCanGoForward()
            .then((canForward) => {
              menu.canForward = canForward;
              return Promise.resolve(menu);
            });
          })
          .then((menu) => {
              var menus = [
                { "text": "Refresh" },
              ];
              if (menu.canBack) {
                menus.push({ "text": "Go Back" });
              }
              if (menu.canForward) {
                menus.push({ "text": "Go Forward" });
              }
              if (this.data.loading) {
                menus.push({ "text": "Stop" });
              }
              menus.push({ "text": "Quit" });
              sk.classList.remove("sr-only");
              navigator.spatialNavigationEnabled = false;
              this.$router.showOptionMenu('Options', menus, 'Select', (selected) => {
                if (selected.text === 'Refresh') {
                  window['currentTab'].iframe.reload();
                } else if (selected.text === 'Go Back') {
                  window['currentTab'].iframe.goBack();
                } else if (selected.text === 'Go Forward') {
                  window['currentTab'].iframe.goForward();
                } else if (selected.text === 'Stop') {
                  window['currentTab'].iframe.stop();
                } else if (selected.text === 'Quit') {
                  this.$router.pop();
                }
              }, () => {
                if (this.$router.stack[this.$router.stack.length - 1].name === 'browser') {
                  sk.classList.add("sr-only");
                  navigator.spatialNavigationEnabled = true;
                } else if (this.$router.stack.length > 2) {
                  if (this.$router.stack[this.$router.stack.length - 2].name === 'browser') {
                    sk.classList.add("sr-only");
                    navigator.spatialNavigationEnabled = true;
                  }
                }
              }, 0);
          })
          .catch((_err_) => {
            console.log(_err_);
          });
        }
      });
      currentTab.iframe.addEventListener('mozbrowserloadstart', (event) => {
        document.getElementById('search-menu').classList.remove('sr-only');
        document.getElementById('option-menu').classList.remove('sr-only');
        document.getElementById('done-btn').classList.add('sr-only');
        this.$router.showLoading(false);
        this.data.loading = true;
      });
      currentTab.iframe.addEventListener('mozbrowserloadend', (event) => {
        this.$router.hideLoading();
        this.data.loading = false;
      });
      currentTab.iframe.addEventListener('mozbrowseropenwindow', (event) => {
        //console.log('mozbrowseropenwindow', event);
      });
      currentTab.iframe.addEventListener('mozbrowseropentab', (event) => {
        //console.log('mozbrowseropentab', event);
      });
      currentTab.iframe.addEventListener('mozbrowserscroll', (event) => {
        //console.log('mozbrowserscroll', event);
      });
      currentTab.iframe.addEventListener('mozbrowsersecuritychange', (event) => {
        //console.log('mozbrowsersecuritychange', event.detail.state);
      });
      window['currentTab'] = currentTab;

      var container = document.querySelector('#browser-iframe');
      var root1 = container.createShadowRoot();
      var root2 = container.createShadowRoot();
      root1.appendChild(currentTab.iframe);
      var shadow = document.createElement('shadow');
      root2.appendChild(shadow);
    },
    unmounted: function() {
      this.$router.hideLoading();
      const sk = document.getElementById('__kai_soft_key__');
      sk.classList.remove("sr-only");
      const kr = document.getElementById('__kai_router__');
      kr.classList.remove("full-screen-browser");
      console.log('unmount browser');
      navigator.spatialNavigationEnabled = false;
      this.$router.setHeaderTitle('K-Pocket Browser');
    },
    methods: {
      listenState: function(data) {
        this.render()
      }
    },
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {
        const sk = document.getElementById('__kai_soft_key__');
        navigator.spatialNavigationEnabled = false;
        sk.classList.remove("sr-only");
        const urlDialog = Kai.createDialog('URL', '<div><input id="url-input" type="text" style="width:97%;"/></div>', null, 'Go', undefined, 'Cancel', undefined, undefined, this.$router);
        urlDialog.mounted = () => {
          setTimeout(() => {
            const URL = document.getElementById('url-input');
            URL.value = this.$state.getState('redirect_url');
            URL.focus();
            URL.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    sk.classList.add("sr-only");
                    setTimeout(() => {
                      URL.blur();
                      navigator.spatialNavigationEnabled = true;
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  sk.classList.add("sr-only");
                  this.$state.setState('redirect_url', URL.value);
                  console.log(this.$state.getState('redirect_url'));
                  window['currentTab'].iframe.src = URL.value;
                  setTimeout(() => {
                    URL.blur();
                    navigator.spatialNavigationEnabled = true;
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  sk.classList.add("sr-only");
                  setTimeout(() => {
                    URL.blur();
                    navigator.spatialNavigationEnabled = true;
                  }, 100);
                  break
              }
            });
          });
        }
        this.$router.showBottomSheet(urlDialog);
      },
      center: function() {},
      right: function() {}
    },
    backKeyListener: function() {
      window['currentTab'].getCanGoBack()
      .then((canGoBack) => {
        if (canGoBack) {
          window['currentTab'].goBack();
        } else {
          this.$router.pop();
        }
      });
      return true;
    }
  });

  const homepage = new Kai({
    name: 'homepage',
    data: {
      title: 'homepage',
      offset: -1,
      articles: [],
      empty: true,
      POCKET_ACCESS_TOKEN: null
    },
    verticalNavClass: '.homepageNav',
    templateUrl: document.location.origin + '/templates/homepage.html',
    mounted: function() {
      console.log('homepage mount');
      navigator.spatialNavigationEnabled = false;
      localforage.getItem('POCKET_ACCESS_TOKEN')
      .then((POCKET_ACCESS_TOKEN) => {
        if (POCKET_ACCESS_TOKEN != null) {
          this.setData({ POCKET_ACCESS_TOKEN: POCKET_ACCESS_TOKEN });
          if (this.data.offset === -1) {
            this.methods.loadArticles(0);
          } else {
            if (this.data.articles.length > 0) {
              this.$router.setSoftKeyRightText('More');
            }
          }
        }
      });
    },
    unmounted: function() {
      console.log('homepage unmount')
    },
    methods: {
      loadArticles: function(_offset) {
        const _this = this;
        localforage.getItem('POCKET_ACCESS_TOKEN')
        .then((POCKET_ACCESS_TOKEN) => {
          if (POCKET_ACCESS_TOKEN != null) {
            this.$router.showLoading();
            getPocketApi(POCKET_ACCESS_TOKEN.access_token, 'GET', { sort: 'newest', count: COUNT, offset: _offset })
            .then((res) => {
              const listLength = Object.keys(res.response.list).length;
              if (listLength === 0) {
                _this.setData({ offset: null });
              } else {
                const newArticles = [];
                const arr = Object.entries(res.response.list);
                for (var i in arr) {
                  if (arr[i][1].top_image_url) {
                    arr[i][1]['preview'] = arr[i][1].top_image_url;
                  } else {
                    arr[i][1]['preview'] = arr[i][1].domain_metadata.logo;
                  }
                  arr[i][1]['isArticle'] = true;
                  newArticles.push(arr[i][1]);
                }
                const filtered = _this.data.articles.filter((item, pos) => {
                  return item.isArticle === true;
                })
                const merged = [...filtered, ...newArticles];
                merged.sort((a, b) => {
                  if (a['time_added'] < b['time_added'])
                    return 1;
                  else if (a['time_added'] > b['time_added'])
                    return -1;
                  return 0;
                });
                if (listLength < COUNT) {
                  _this.setData({ offset: null });
                  _this.setData({ articles: merged });
                } else {
                  _this.setData({ offset: merged.length });
                  _this.setData({ articles: [...merged, ...[{ isArticle: null }]] });
                }
                if (_this.data.articles.length > 0) {
                  _this.$router.setSoftKeyRightText('More');
                  _this.setData({ empty: false });
                } else {
                  _this.$router.setSoftKeyRightText('');
                  _this.setData({ empty: true });
                }
                //_this.setData({ empty: true });
                //_this.setData({ articles: [] });
                console.log(_this.data.articles);
              }
            })
            .catch((err) => {
              console.log(err);
            })
            .finally(() => {
              this.$router.hideLoading();
            });
          }
        });
      },
      nextPage: function() {
        this.methods.loadArticles(this.data.offset);
      }
    },
    softKeyText: { left: 'Menu', center: '', right: '' },
    softKeyListener: {
      left: function() {
        localforage.getItem('POCKET_ACCESS_TOKEN')
        .then((res) => {
          var title = 'Menu';
          var menu = [
            { "text": "Login" },
            { "text": "Browser" }
          ];
          if (res) {
            title = res.username;
            menu = [
              { "text": "Browser" },
              { "text": "Refresh" },
              { "text": "Archive" },
              { "text": "Logout" }
            ];
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Login') {
              loginPage(this.$router);
            } else if (selected.text === 'Browser') {
              this.$router.push('browser');
            } else if (selected.text === 'Logout') {
              localforage.removeItem('POCKET_ACCESS_TOKEN');
              this.verticalNavIndex = 0;
              this.$router.setSoftKeyRightText('');
              this.setData({ POCKET_ACCESS_TOKEN: null });
              this.setData({ articles: [], offset: -1 });
            } else if (selected.text === 'Refresh') {
              this.verticalNavIndex = 0;
              this.setData({ articles: [] });
              this.methods.loadArticles(0);
            }
          }, () => {}, 0);
        })
        .catch((err) => {
          console.log(err);
        });
      },
      center: function() {
        if (this.verticalNavIndex > -1) {
          const nav = document.querySelectorAll(this.verticalNavClass);
          nav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    backKeyListener: function() {
      return false;
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex === 0) {
          return;
        }
        this.navigateListNav(-1);
        if (this.data.articles[this.verticalNavIndex].isArticle) {
          this.$router.setSoftKeyRightText('More');
        } else {
          this.$router.setSoftKeyRightText('');
        }
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        if (this.verticalNavIndex === (this.data.articles.length - 1)) {
          return;
        }
        this.navigateListNav(1);
        if (this.data.articles[this.verticalNavIndex].isArticle) {
          this.$router.setSoftKeyRightText('More');
        } else {
          this.$router.setSoftKeyRightText('');
        }
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const router = new KaiRouter({
    title: 'K-Pocket Browser',
    routes: {
      'index' : {
        name: 'homepage',
        component: homepage
      },
      'browser' : {
        name: 'browser',
        component: browser
      },
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {
      console.log('_APP_ mounted');
    },
    unmounted: function() {
      console.log('_APP_ unmounted');
    },
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  IFRAME_TIMER = setInterval(() => {
    //console.log('OUTER', document.activeElement.tagName);
    if (document.activeElement.tagName === 'IFRAME') {
      navigator.spatialNavigationEnabled = true;
      document.getElementById('search-menu').classList.add('sr-only');
      document.getElementById('option-menu').classList.add('sr-only');
      document.getElementById('done-btn').classList.remove('sr-only');
    }
  }, 500);

  document.addEventListener('visibilitychange', () => {
    console.log(`Tab state : ${document.visibilityState}`);
    if (app.$router.stack.length === 1) {
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 500);
    }

    if (document.activeElement.tagName === 'IFRAME') {
      document.activeElement.blur();
    }
    
    if (document.visibilityState === 'hidden') {
      if (IFRAME_TIMER) {
        clearInterval(IFRAME_TIMER);
      }
    } else if (document.visibilityState === 'visible') {
      const browser = app.$router.stack[app.$router.stack.length - 1];
      if (browser.name === 'browser') {
        if (document.activeElement.tagName !== 'IFRAME') {
          document.getElementById('search-menu').classList.remove('sr-only');
          document.getElementById('option-menu').classList.remove('sr-only');
          document.getElementById('done-btn').classList.add('sr-only');
        }
      }
      IFRAME_TIMER = setInterval(() => {
        //console.log('INNER', document.activeElement.tagName);
        if (document.activeElement.tagName === 'IFRAME') {
          navigator.spatialNavigationEnabled = true;
          document.getElementById('search-menu').classList.add('sr-only');
          document.getElementById('option-menu').classList.add('sr-only');
          document.getElementById('done-btn').classList.remove('sr-only');
        }
      }, 500);
    }
  });

  window.addEventListener('keydown', () => {
    //console.log('keydown window');
  }, true);

  document.addEventListener('keydown', () => {
    //console.log('keydown document');
  }, true);

});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then(function(swReg) {
    console.error('Service Worker Registered');
  })
  .catch(function(error) {
    console.error('Service Worker Error', error);
  });
}
