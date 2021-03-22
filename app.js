window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const CONSUMER_KEY = "94872-b408e0508baaa3a6658564f3";
  const COUNT = 24;
  var IFRAME_TIMER;

  const state = new KaiState({
    'target_url': '',
    'editor': '',
  });

  function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
  }

  const getReaderable = function(url) {
    return new Promise(function(resolve, reject) {
      var xhttp = new XMLHttpRequest({ mozSystem: true });
      xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
          const parser = new DOMParser();
          try {
            const doc = parser.parseFromString(xhttp.responseText, "text/html");
            if (isProbablyReaderable(doc)) {
              var result = new Readability(doc).parse();
              var hashids = new Hashids(url, 10);
              result.hashid = hashids.encode(1);
              result.url = url;
              resolve(result);
            } else {
              reject('notReaderable');
            }
          } catch (e) {
            reject(e);
          }
        } else if (xhttp.readyState == 4 && xhttp.status != 200) {
          reject(xhttp.status);
        }
      };
      xhttp.open("GET", url, true);
      xhttp.send();
    });
  }

  const readabilityPage = function($router, url, title, save) {
    var hashids = new Hashids(url, 10);
    var id = hashids.encode(1);
    localforage.getItem('CONTENT___' + (validURL(url) ? id : url))
    .then((article) => {
      if (article != null) {
        setTimeout(() => {
          $router.push(new Kai({
            name: 'readabilityPage',
            data: {
              title: 'readabilityPage'
            },
            template: '<div style="padding:4px;"><style>img{width:100%;height:auto;}.kui-software-key{height:0px}</style><h4 style="margin-bottom:4px;">' + title + '</h4>' + article + '</div>'
          }));
        }, 150);
      } else {
        $router.showLoading();
        getReaderable(url)
        .then((res) => {
          $router.hideLoading();
          const clean = DOMPurify.sanitize(res.content);
          if (save) {
            localforage.getItem('ARTICLES')
            .then((articles) => {
              if (articles == null) {
                articles = []
              }
              delete res.content;
              articles.reverse();
              articles.push(res);
              articles.reverse();
              localforage.setItem('ARTICLES', articles)
              .then(() => {
                localforage.setItem('CONTENT___' + res.hashid, clean)
                .then(() => {
                  $router.showToast('Saved');
                });
              });
            })
            return
          }
          $router.push(new Kai({
            name: 'readabilityPage',
            data: {
              title: 'readabilityPage'
            },
            template: '<div style="padding:4px;"><style>img{width:100%;height:auto;}.kui-software-key{height:0px}</style><h4 style="margin-bottom:4px;">' + res.title + '</h4>' + clean + '</div>'
          }))
        })
        .catch((e) => {
          console.log(e)
          $router.hideLoading();
          $router.showToast(e.toString());
        });
      }
    })
  }

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

  const helpSupportPage = new Kai({
    name: 'helpSupportPage',
    data: {
      title: 'helpSupportPage'
    },
    template: '<div style="padding:4px;"><style>.kui-software-key{height:0px}</style><b>NOTICE</b><br>Save button within the https://getpocket.com/explore is not working. Please use `Save to GetPocket` to save website you visited to your GetPocket account<br><br><b>Reader View</b><br>Parses html text (usually news and other articles) and returns title, author, main image and text content without nav bars, ads, footers, or anything that isn\'t the main body of the text. Analyzes each node, gives them a score, and determines what\'s relevant and what can be discarded<br><br> <b>Shortcut Key</b><br>* 1 Zoom-out<br> * 2 Reset zoom<br> * 3 Zoom-in<br> * 5 Hide/Show menu</div>',
    mounted: function() {
      this.$router.setHeaderTitle('Help & Support');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const loginPage = function($router) {
    var REQUEST_TOKEN;
    var oauthRequest = new XMLHttpRequest({ mozSystem: true });
    var params = {
      "consumer_key": CONSUMER_KEY,
      "redirect_uri": "https://getpocket.com/en/about"
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
              navigator.spatialNavigationEnabled = true;
              var frameContainer = document.getElementById('login-container');
              currentTab = new Tab(url);
              currentTab.iframe.setAttribute('height', '296px;');
              currentTab.iframe.setAttribute('frameBorder', '0');
              var container = document.querySelector('#login-container');
              var root1 = container.createShadowRoot();
              var root2 = container.createShadowRoot();
              root1.appendChild(currentTab.iframe);
              var shadow = document.createElement('shadow');
              root2.appendChild(shadow);
              currentTab.iframe.addEventListener('mozbrowserlocationchange', function (e) {
                if (e.detail.url === 'https://getpocket.com/en/about' || (e.detail.url.indexOf('success.html') > -1)) {
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
                        })
                        .catch((err) => {
                          $router.showToast('Error saving token');
                        })
                        .finally(() => {
                          $router.pop();
                        });
                      } else {
                        $router.showToast('Invalid response');
                        $router.pop();
                      }
                    } else if (oauthAuthorize.status == 403) {
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
          //console.log(oauthRequest);
        }
      } else {
        $router.hideLoading();
      }
    }
    $router.showLoading();
    oauthRequest.send(JSON.stringify(params));
  }

  const offlineArticles = new Kai({
    name: 'offlineArticles',
    data: {
      title: 'offlineArticles',
      articles: [],
      empty: true
    },
    methods: {
      getArticles: function() {
        localforage.getItem('ARTICLES')
        .then((articles) => {
          if (articles != null) {
            if (articles.length > -1) {
              if (articles.length > 0) {
                if (this.verticalNavIndex > (articles.length - 1)) {
                  this.verticalNavIndex = this.verticalNavIndex - 1
                }
                this.$router.setSoftKeyText('Delete', 'OPEN', 'Options')
              }
              this.setData({
                articles: articles,
                empty: (articles.length === 0 ? true : false)
              });
            }
          }
        });
      }
    },
    mounted: function() {
      this.$router.setHeaderTitle('Saved Reader View');
      this.methods.getArticles();
    },
    unmounted: function() {
      this.data.articles = []
    },
    verticalNavClass: '.offlineArticlesNav',
    templateUrl: document.location.origin + '/templates/offlineArticles.html',
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex === 0) {
          return;
        }
        this.navigateListNav(-1);
      },
      arrowRight: function() {},
      arrowDown: function() {
        if (this.verticalNavIndex === (this.data.articles.length - 1)) {
          return;
        }
        this.navigateListNav(1);
      },
      arrowLeft: function() {},
    },
    softKeyListener: {
      left: function() {
        var current = this.data.articles[this.verticalNavIndex];
        this.$router.showDialog('Confirm', 'Are you sure to remove ' + current.title + ' ?', null, 'Yes', () => {
          localforage.getItem('ARTICLES')
          .then((articles) => {
            var filtered = [];
            if (articles != null) {
              filtered = articles.filter(function(a) {
                return a.hashid != current.hashid;
              });
              localforage.setItem('ARTICLES', filtered)
              .then(() => {
                localforage.removeItem('CONTENT___' + current.hashid)
                this.$router.showToast('Success');
                this.methods.getArticles();
              });
            }
          })
        }, 'No', () => {}, '', () => {}, () => {});
      },
      center: function() {
        var current = this.data.articles[this.verticalNavIndex];
        readabilityPage(this.$router, current.hashid, current.title, false);
      },
      right: function() {
        var current = this.data.articles[this.verticalNavIndex];
        var menus = [
          { "text": "Open with built-in browser" },
          { "text": "Open with KaiOS Browser" }
        ];
        this.$router.showOptionMenu('Options', menus, 'Select', (selected) => {
          if (selected.text === 'Open with built-in browser') {
            this.$state.setState('target_url', current.url);
            this.$router.push('browser');
          } else if (selected.text === 'Open with KaiOS Browser') {
            var activity = new MozActivity({
              name: "view",
              data: {
                type: "url",
                url: current.url
              }
            });
          }
        }, () => {
          if (this.data.articles.length > 0) {
            setTimeout(() => {
              this.$router.setSoftKeyText('Delete', 'OPEN', 'Options')
            }, 100);
          }
        }, 0)
      }
    }
  })

  const browser = new Kai({
    name: 'browser',
    data: {
      title: 'browser',
      loading: false,
      zoom: 1,
    },
    templateUrl: document.location.origin + '/templates/browser.html',
    mounted: function() {
      const sk = document.getElementById('__kai_soft_key__');
      sk.classList.add("sr-only");
      const kr = document.getElementById('__kai_router__');
      kr.classList.add("full-screen-browser");
      navigator.spatialNavigationEnabled = true;
      var frameContainer = document.getElementById('browser-iframe');
      var root = frameContainer.createShadowRoot();
      var TARGET_URL = this.$state.getState('target_url');
      if (TARGET_URL === '') {
        TARGET_URL = 'https://www.google.com/';
      } else if (!validURL(TARGET_URL)) {
        TARGET_URL = 'https://www.google.com/search?q=' + TARGET_URL;
      }
      this.$state.setState('target_url', TARGET_URL);
      currentTab = new Tab(TARGET_URL);
      currentTab.iframe.setAttribute('style', 'position:fixed;margin-top:28px;top:0;height:91%;width:100%;');
      currentTab.iframe.setAttribute('frameBorder', '0');
      currentTab.iframe.addEventListener('mozbrowserlocationchange', (e) => {
        this.$state.setState('target_url', e.detail.url);
        this.$router.setHeaderTitle(e.detail.url);
        localforage.getItem('POCKET_HISTORY')
        .then((history) => {
          if (history == null) {
            history = [];
          }
          const _history = history.filter((obj) => {
            return obj.url !== window['currentTab'].url.url;
          });
          _history.reverse();
          _history.push({ title: window['currentTab'].title, url: window['currentTab'].url.url });
          _history.reverse();
          if (_history.length > 50) {
            _history.pop();
          }
          localforage.setItem('POCKET_HISTORY', _history);
        });
      });
      currentTab.iframe.addEventListener('mozbrowsercontextmenu', (event) => {
        if (document.activeElement.tagName === 'IFRAME') {
          document.activeElement.blur();
          document.getElementById('search-menu').classList.remove('sr-only');
          document.getElementById('option-menu').classList.remove('sr-only');
          document.getElementById('done-btn').classList.add('sr-only');
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
        localforage.getItem('POCKET_HISTORY')
        .then((history) => {
          if (history == null) {
            history = [];
          }
          if (history.length > 0) {
            history[0].title = window['currentTab'].title;
          }
          localforage.setItem('POCKET_HISTORY', history);
        });
      });
      currentTab.iframe.addEventListener('mozbrowserscroll', (event) => {
        document.getElementById('search-menu').classList.add('sr-only');
        document.getElementById('option-menu').classList.add('sr-only');
      });
      currentTab.iframe.addEventListener('mozbrowsersecuritychange', (event) => {
        //console.log('mozbrowsersecuritychange', event.detail.state);
      });
      currentTab.iframe.addEventListener('mozbrowsererror', (event) => {
        //console.log('mozbrowsererror', event);
      });
      window['currentTab'] = currentTab;

      var container = document.querySelector('#browser-iframe');
      var root1 = container.createShadowRoot();
      var root2 = container.createShadowRoot();
      root1.appendChild(currentTab.iframe);
      var shadow = document.createElement('shadow');
      root2.appendChild(shadow);
      document.addEventListener('keydown', this.methods.keyListener);
    },
    unmounted: function() {
      this.$router.hideLoading();
      const sk = document.getElementById('__kai_soft_key__');
      sk.classList.remove("sr-only");
      const kr = document.getElementById('__kai_router__');
      kr.classList.remove("full-screen-browser");
      navigator.spatialNavigationEnabled = false;
      this.$router.setHeaderTitle('K-Pocket Browser');
      document.removeEventListener('keydown', this.methods.keyListener);
    },
    methods: {
      listenState: function(data) {
        this.render()
      },
      keyListener: function(evt) {
        if (document.activeElement.tagName !== 'IFRAME' || document.activeElement.tagName !== 'INPUT') {
          switch (evt.key) {
            case 'ArrowDown':
            case 'ArrowUp':
              const URL = document.getElementById('url-input');
              if (URL == null) {
                break
              }
              URL.focus();
              evt.preventDefault();
              evt.stopPropagation();
              break
            case '1':
              if (this.data.zoom > 0.25) {
                this.data.zoom -= 0.25;
                window['currentTab'].iframe.zoom(this.data.zoom);
              }
              break
            case '2':
              this.data.zoom = 1;
              window['currentTab'].iframe.zoom(this.data.zoom);
              break
            case '3':
              if (this.data.zoom < 3) {
                this.data.zoom += 0.25;
                window['currentTab'].iframe.zoom(this.data.zoom);
              }
              break
            case '5':
              if (document.getElementById('search-menu').classList.contains('sr-only')) {
                document.getElementById('search-menu').classList.remove('sr-only');
                document.getElementById('option-menu').classList.remove('sr-only');
              } else {
                document.getElementById('search-menu').classList.add('sr-only');
                document.getElementById('option-menu').classList.add('sr-only');
              }
              break
          }
        }
      },
      rightMenu: function() {
        const sk = document.getElementById('__kai_soft_key__');
        if (document.activeElement.tagName === 'IFRAME') {
          document.activeElement.blur();
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
            return localforage.getItem('POCKET_BOOKMARKS')
            .then((bookmarks) => {
              menu.bookmark = false;
              if (bookmarks == null) {
                menu.bookmark = false;
              } else {
                const exist = bookmarks.filter((obj) => {
                  return obj.url === window['currentTab'].url.url;
                });
                if (exist.length > 0) {
                  menu.bookmark = true;
                }
              }
              return Promise.resolve(menu);
            });
          })
          .then((menu) => {
            return localforage.getItem('POCKET_ACCESS_TOKEN')
            .then((res) => {
              menu.isLoggedIn = false;
              if (res != null) {
                menu.isLoggedIn = true;
              }
              return Promise.resolve(menu);
            })
          })
          .then((menu) => {
            var hashids = new Hashids(window['currentTab'].url.url, 10);
            var id = hashids.encode(1);
            return localforage.getItem('CONTENT___' + id)
            .then((article) => {
              menu.savedArticle = false;
              if (article != null) {
                menu.savedArticle = true;
              }
              return Promise.resolve(menu);
            })
          })
          .then((menu) => {
              var menus = [
                { "text": "Refresh" }
              ];
              if (menu.isLoggedIn) {
                menus.push({ "text": "Save to GetPocket" });
              }
              if (menu.canBack) {
                menus.push({ "text": "Go Back" });
              }
              if (menu.canForward) {
                menus.push({ "text": "Go Forward" });
              }
              if (this.data.loading) {
                menus.push({ "text": "Stop" });
              }
              if (menu.bookmark) {
                menus.push({ "text": "Remove Bookmark" });
              } else {
                menus.push({ "text": "Add Bookmark" });
              }
              menus.push({ "text": "Bookmarks" });
              menus.push({ "text": "History" });
              menus.push({ "text": "Clear History" });
              menus.push({ "text": "Open with Reader View" });
              if (menu.savedArticle) {
                menus.push({ "text": "Delete Reader View" });
              } else {
                menus.push({ "text": "Save Reader View" });
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
                } else if (selected.text === 'Save to GetPocket') {
                  this.$router.showLoading(false);
                  localforage.getItem('POCKET_ACCESS_TOKEN')
                  .then((POCKET_ACCESS_TOKEN) => {
                    if (POCKET_ACCESS_TOKEN != null) {
                      getPocketApi(POCKET_ACCESS_TOKEN.access_token, 'GET', { search: this.$state.getState('target_url') })
                      .then((res) => {
                        if (Object.keys(res.response.list).length > 0) {
                          this.$router.showToast('Already saved to GetPocket');
                        } else {
                          this.$router.showLoading(false);
                          getPocketApi(POCKET_ACCESS_TOKEN.access_token, 'ADD', { url: this.$state.getState('target_url') })
                          .then((res) => {
                            this.$router.showToast('Saved to GetPocket');
                          })
                          .finally(() => {
                            this.$router.hideLoading(false);
                          })
                        }
                      })
                    }
                  })
                  .finally(() => {
                    this.$router.hideLoading(false);
                  })
                } else if (selected.text === 'Add Bookmark') {
                  var bookmark = {
                    title: window['currentTab'].title,
                    url: window['currentTab'].url.url
                  }
                  localforage.getItem('POCKET_BOOKMARKS')
                  .then((bookmarks) => {
                    if (bookmarks == null) {
                      bookmarks = []
                    }
                    bookmarks.push(bookmark);
                    localforage.setItem('POCKET_BOOKMARKS', bookmarks);
                    this.$router.showToast('Added');
                  });
                } else if (selected.text === 'Remove Bookmark') {
                  localforage.getItem('POCKET_BOOKMARKS')
                  .then((bookmarks) => {
                    if (bookmarks == null) {
                      bookmarks = [];
                    }
                    const filtered = bookmarks.filter((obj) => {
                      return obj.url !== window['currentTab'].url.url;
                    });
                    localforage.setItem('POCKET_BOOKMARKS', filtered);
                    this.$router.showToast('Removed');
                  });
                } else if (selected.text === 'Quit') {
                  this.$state.setState('target_url', '');
                  this.$router.pop();
                } else if (selected.text === 'Bookmarks') {
                  localforage.getItem('POCKET_BOOKMARKS')
                  .then((bookmarks) => {
                    if (bookmarks) {
                      if (bookmarks.length > 0) {
                        var b = [];
                        bookmarks.forEach((i) => {
                          b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                        });
                        this.$router.showOptionMenu('Bookmarks', b, 'OPEN', (selected) => {
                          this.$state.setState('target_url', selected.subtext);
                          window['currentTab'].iframe.src = selected.subtext;
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
                      }
                    }
                  });
                } else if (selected.text === 'History') {
                  localforage.getItem('POCKET_HISTORY')
                  .then((history) => {
                    if (history) {
                      if (history.length > 0) {
                        var b = [];
                        history.forEach((i) => {
                          b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                        });
                        this.$router.showOptionMenu('History', b, 'OPEN', (selected) => {
                          this.$state.setState('target_url', selected.subtext);
                          window['currentTab'].iframe.src = selected.subtext;
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
                      }
                    }
                  });
                } else if (selected.text === 'Clear History') {
                  this.$router.showDialog('Confirm', 'Are you sure to clear history ?', null, 'Yes', () => {
                    localforage.removeItem('POCKET_HISTORY')
                    this.$router.showToast('History Cleared');
                  }, 'No', () => {}, '', () => {}, () => {
                    if (this.$router.stack[this.$router.stack.length - 1].name === 'browser') {
                      sk.classList.add("sr-only");
                      navigator.spatialNavigationEnabled = true;
                    } else if (this.$router.stack.length > 2) {
                      if (this.$router.stack[this.$router.stack.length - 2].name === 'browser') {
                        sk.classList.add("sr-only");
                        navigator.spatialNavigationEnabled = true;
                      }
                    }
                  });
                } else if (selected.text === 'Open with Reader View') {
                  var title = typeof window['currentTab'].title === 'string' ? window['currentTab'].title : '';
                  readabilityPage(this.$router, window['currentTab'].url.url, title, false);
                } else if (selected.text === 'Save Reader View') {
                  readabilityPage(this.$router, window['currentTab'].url.url, '', true);
                } else if (selected.text === 'Delete Reader View') {
                  var hashids = new Hashids(window['currentTab'].url.url, 10);
                  var id = hashids.encode(1);
                  localforage.getItem('ARTICLES')
                  .then((articles) => {
                    var filtered = [];
                    if (articles != null) {
                      filtered = articles.filter(function(a) {
                        return a.hashid != id;
                      });
                      localforage.setItem('ARTICLES', filtered)
                      .then(() => {
                        localforage.removeItem('CONTENT___' + id)
                        this.$router.showToast('Success');
                      });
                    }
                  })
                }
              }, () => {
                setTimeout(() => {
                  if (this.$router.stack[this.$router.stack.length - 1].name === 'browser' && !this.$router.bottomSheet) {
                    sk.classList.add("sr-only");
                    navigator.spatialNavigationEnabled = true;
                  } else if (this.$router.stack.length > 2 && !this.$router.bottomSheet) {
                    if (this.$router.stack[this.$router.stack.length - 2].name === 'browser') {
                      sk.classList.add("sr-only");
                      navigator.spatialNavigationEnabled = true;
                    }
                  }
                }, 100);
              }, 0);
          })
          .catch((_err_) => {
            //console.log(_err_);
          });
        }
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
            if (!URL) {
              return;
            }
            URL.focus();
            URL.value = this.$state.getState('target_url');
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
                  
                  var TARGET_URL = URL.value;
                  if (!validURL(TARGET_URL)) {
                    TARGET_URL = 'https://www.google.com/search?q=' + TARGET_URL;
                  }
                  this.$state.setState('target_url', TARGET_URL);
                  window['currentTab'].iframe.src = TARGET_URL;
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
      right: function() {
        this.methods.rightMenu();
      }
    },
    backKeyListener: function() {
      window['currentTab'].getCanGoBack()
      .then((canGoBack) => {
        if (canGoBack) {
          window['currentTab'].goBack();
        } else {
          this.$state.setState('target_url', '');
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
      this.$router.setHeaderTitle('K-Pocket Browser');
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
    unmounted: function() {},
    methods: {
      loadArticles: function(_offset) {
        const _this = this;
        localforage.getItem('POCKET_ACCESS_TOKEN')
        .then((POCKET_ACCESS_TOKEN) => {
          if (POCKET_ACCESS_TOKEN != null) {
            this.$router.showLoading();
            getPocketApi(POCKET_ACCESS_TOKEN.access_token, 'GET', { state: 'all', sort: 'newest', count: COUNT, offset: _offset })
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
              }
            })
            .catch((err) => {
              //console.log(err);
            })
            .finally(() => {
              this.$router.hideLoading();
            });
          }
        });
      },
      deleteArticle: function() {
        var current = this.data.articles[this.verticalNavIndex];
        const params = [{
          "action" : "delete",
          "item_id" : current.item_id.toString(),
        }];
        this.$router.showDialog('Confirm', 'Are you sure to remove ' + current.resolved_title + ' ?', null, 'Yes', () => {
          const _this = this;
          localforage.getItem('POCKET_ACCESS_TOKEN')
          .then((POCKET_ACCESS_TOKEN) => {
            if (POCKET_ACCESS_TOKEN != null) {
              this.$router.showLoading();
              getPocketApi(POCKET_ACCESS_TOKEN.access_token, 'UPDATE', {actions: params})
              .then((res) => {
                const articles = _this.data.articles.filter((obj) => {
                  if (!obj.isArticle) {
                    return true;
                  }
                  return obj.item_id !== current.item_id.toString();
                });
                if (_this.verticalNavIndex >= articles.length) {
                  _this.verticalNavIndex -= _this.verticalNavIndex;
                }
                _this.setData({ articles: articles, offset: (articles.length - 1) });
              })
              .catch((err) => {
                //console.log(err);
              })
              .finally(() => {
                this.$router.hideLoading();
              });
            }
          });
        }, 'No', () => {}, '', () => {}, () => {
          setTimeout(() => {
            if (this.data.articles[this.verticalNavIndex].isArticle) {
              this.$router.setSoftKeyRightText('More');
            } else {
              this.$router.setSoftKeyRightText('');
            }
          }, 100);
        });
      },
      nextPage: function() {
        this.methods.loadArticles(this.data.offset);
      },
      selected: function() {}
    },
    softKeyText: { left: 'Menu', center: '', right: '' },
    softKeyListener: {
      left: function() {
        localforage.getItem('POCKET_ACCESS_TOKEN')
        .then((res) => {
          var title = 'Menu';
          var menu = [
            { "text": "Help & Support" },
            { "text": "Login" },
            { "text": "Web Browser" },
            { "text": "Saved Reader View" },
            { "text": "Bookmarks" },
            { "text": "History" },
            { "text": "Clear History" }
          ];
          if (res) {
            title = res.username;
            menu = [
              { "text": "Help & Support" },
              { "text": "Refresh" },
              { "text": "Web Browser" },
              { "text": "Saved Reader View" },
              { "text": "Bookmarks" },
              { "text": "History" },
              { "text": "Clear History" },
              { "text": "Logout" }
            ];
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Login') {
              loginPage(this.$router);
            } else if (selected.text === 'Web Browser') {
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
            } else if (selected.text === 'Bookmarks') {
              localforage.getItem('POCKET_BOOKMARKS')
              .then((bookmarks) => {
                if (bookmarks) {
                  if (bookmarks.length > 0) {
                    var b = [];
                    bookmarks.forEach((i) => {
                      b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                    });
                    this.$router.showOptionMenu('Bookmarks', b, 'OPEN', (selected) => {
                      this.$state.setState('target_url', selected.subtext);
                      setTimeout(() => {
                        this.$router.push('browser');
                      }, 100);
                    }, () => {
                      setTimeout(() => {
                        if (!this.$router.bottomSheet) {
                          if (this.data.articles[this.verticalNavIndex].isArticle) {
                            this.$router.setSoftKeyRightText('More');
                          } else {
                            this.$router.setSoftKeyRightText('');
                          }
                        }
                      }, 100);
                    }, 0);
                  }
                }
              });
            } else if (selected.text === 'History') {
              localforage.getItem('POCKET_HISTORY')
              .then((history) => {
                if (history) {
                  if (history.length > 0) {
                    var b = [];
                    history.forEach((i) => {
                      b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                    });
                    this.$router.showOptionMenu('History', b, 'OPEN', (selected) => {
                      this.$state.setState('target_url', selected.subtext);
                      setTimeout(() => {
                        this.$router.push('browser');
                      }, 100);
                    }, () => {
                      setTimeout(() => {
                        if (!this.$router.bottomSheet) {
                          if (this.data.articles[this.verticalNavIndex].isArticle) {
                            this.$router.setSoftKeyRightText('More');
                          } else {
                            this.$router.setSoftKeyRightText('');
                          }
                        }
                      }, 100);
                    }, 0);
                  }
                }
              });
            } else if (selected.text === 'Clear History') {
              this.$router.showDialog('Confirm', 'Are you sure to clear history ?', null, 'Yes', () => {
                localforage.removeItem('POCKET_HISTORY')
                this.$router.showToast('History Cleared');
              }, 'No', () => {}, '', () => {}, () => {
                setTimeout(() => {
                  if (this.data.articles[this.verticalNavIndex].isArticle) {
                    this.$router.setSoftKeyRightText('More');
                  } else {
                    this.$router.setSoftKeyRightText('');
                  }
                }, 100);
              });
            } else if (selected.text ===  'Help & Support') {
              this.$router.push('helpSupportPage');
            } else if (selected.text === 'Saved Reader View') {
              setTimeout(() => {
                this.$router.push('offlineArticles');
              }, 110);
            }
          }, () => {
            setTimeout(() => {
              if (!this.$router.bottomSheet && this.$router.stack[this.$router.stack.length - 1].name === 'homepage') {
                if (this.data.articles[this.verticalNavIndex].isArticle) {
                  this.$router.setSoftKeyRightText('More');
                } else {
                  this.$router.setSoftKeyRightText('');
                }
              }
            }, 100);
          }, 0);
        })
        .catch((err) => {
          //console.log(err);
        });
      },
      center: function() {
        if (this.verticalNavIndex > -1) {
          const nav = document.querySelectorAll(this.verticalNavClass);
          nav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        var title = 'Menu';
        var menu = [
          { "text": "Open with built-in browser" },
          { "text": "Open with KaiOS Browser" },
          { "text": "Open with Reader View" },
          { "text": "Save Reader View" },
          { "text": "Delete" }
        ];
        var current = this.data.articles[this.verticalNavIndex];
        var hashids = new Hashids(current.given_url, 10);
        var id = hashids.encode(1);
        localforage.getItem('CONTENT___' + id)
        .then((article) => {
          if (article != null) {
            menu[3] = { "text": "Delete Reader View" }
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Open with built-in browser') {
              this.$state.setState('target_url', current.given_url);
              this.$router.push('browser');
            } else if (selected.text === 'Open with KaiOS Browser') {
              var activity = new MozActivity({
                name: "view",
                data: {
                  type: "url",
                  url: current.given_url
                }
              });
            } else if (selected.text === 'Delete') {
              this.methods.deleteArticle();
            } else if (selected.text === 'Open with Reader View') {
              readabilityPage(this.$router, current.given_url, current.title, false);
            } else if (selected.text === 'Save Reader View') {
              readabilityPage(this.$router, current.given_url, '', true);
            } else if (selected.text === 'Delete Reader View') {
              localforage.getItem('ARTICLES')
              .then((articles) => {
                var filtered = [];
                if (articles != null) {
                  filtered = articles.filter(function(a) {
                    return a.hashid != id;
                  });
                  localforage.setItem('ARTICLES', filtered)
                  .then(() => {
                    localforage.removeItem('CONTENT___' + id)
                    this.$router.showToast('Success');
                  });
                }
              })
            }
          }, () => {
            setTimeout(() => {
              if (!this.$router.bottomSheet) {
                if (this.data.articles[this.verticalNavIndex].isArticle) {
                  this.$router.setSoftKeyRightText('More');
                } else {
                  this.$router.setSoftKeyRightText('');
                }
              }
            }, 100);
          }, 0);
        });
      }
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
      arrowRight: function() {},
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
      arrowLeft: function() {},
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
      'offlineArticles': {
        name: 'offlineArticles',
        component: offlineArticles
        
      },
      'helpSupportPage': {
        name: 'helpSupportPage',
        component: helpSupportPage
      }
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    //console.log(e);
  }

  IFRAME_TIMER = setInterval(() => {
    if (document.activeElement.tagName === 'IFRAME') {
      navigator.spatialNavigationEnabled = true;
      document.getElementById('search-menu').classList.add('sr-only');
      document.getElementById('option-menu').classList.add('sr-only');
      document.getElementById('done-btn').classList.remove('sr-only');
    }
  }, 500);

  document.addEventListener('visibilitychange', () => {
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
          navigator.spatialNavigationEnabled = true;
          document.getElementById('search-menu').classList.remove('sr-only');
          document.getElementById('option-menu').classList.remove('sr-only');
          document.getElementById('done-btn').classList.add('sr-only');
        }
      }
      IFRAME_TIMER = setInterval(() => {
        if (document.activeElement.tagName === 'IFRAME') {
          navigator.spatialNavigationEnabled = true;
          document.getElementById('search-menu').classList.add('sr-only');
          document.getElementById('option-menu').classList.add('sr-only');
          document.getElementById('done-btn').classList.remove('sr-only');
        }
      }, 500);
    }
  });

  getKaiAd({
    publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
    app: 'k-pocket-browser',
    slot: 'kaios',
    onerror: err => console.error(err),
    onready: ad => {
      ad.call('display')
    }
  })

});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then(function(swReg) {
    // console.error('Service Worker Registered');
  })
  .catch(function(error) {
    // console.error('Service Worker Error', error);
  });
}
