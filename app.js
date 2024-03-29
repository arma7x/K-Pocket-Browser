const APP_VERSION = '1.13.0';

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const CONSUMER_KEY = "94872-b408e0508baaa3a6658564f3";
  const COUNT = 24;
  var IFRAME_TIMER;
  var VOLUME_CONTROL_TIMER;
  var KAIOS_BROWSER_TIMER;

  const state = new KaiState({
    'target_url': '',
    'editor': '',
    'disableJS': false,
  });

  const getPocketApi = function(ACCESS_TOKEN, type, config = {}) {
    return new Promise((resolve, reject) => {
      var _URL;
      if (type === 'ADD') {
        _URL = 'https://getpocket.com/v3/add';
      } else if (type === 'UPDATE') {
        _URL = 'https://getpocket.com/v3/send';
      } else if (type === 'GET') {
        _URL = 'https://getpocket.com/v3/get';
      }
      var request = new XMLHttpRequest({ mozSystem: true });
      var params = {
        "consumer_key": CONSUMER_KEY,
        "access_token": ACCESS_TOKEN
      };
      params = Object.assign(params, config);
      request.open('POST', _URL, true);
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

  function takeScreenshot(title, evt) {
    if (evt.key == '*') {
      html2canvas(document.querySelector("#__kai_router__")).then(canvas => {
        canvas.toBlob((blob) => {
          saveAs(blob, `${new Date().getTime().toString()}.png`);
        });
      });
    } else if (evt.key == '#') {
      html2canvas(document.querySelector("#__readabilityPage__")).then(canvas => {
        canvas.toBlob((blob) => {
          saveAs(blob, `${new Date().getTime().toString()}.png`);
        });
      });
    } else if (evt.key == 'Call') {
      try {
        const blob = new Blob([document.querySelector("#__readabilityPage__").innerHTML], {type : 'text/html'});
        saveAs(blob, `${title}_${new Date().getTime().toString()}.html`)
      } catch (e) {
        console.log(e);
      }
    }
  }

  function getURLParam(key, target) {
    var values = [];
    if (!target) target = location.href;
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var pattern = key + '=([^&#]+)';
    var o_reg = new RegExp(pattern,'ig');
    while (true){
      var matches = o_reg.exec(target);
      if (matches && matches[1]){
        values.push(matches[1]);
      } else {
        break;
      }
    }
    if (!values.length){
      return [];
    } else {
      return values.length == 1 ? [values[0]] : values;
    }
  }

  function downloadURL($router, url, title = 'Unknown') {
    $router.showLoading();
    const down = new XMLHttpRequest({ mozSystem: true });
    down.open('GET', url, true);
    down.responseType = 'blob';
    down.onload = (evt) => {
      var mime = '';
      try {
        const n = evt.currentTarget.response.type.split('/');
        mime = n[n.length - 1];
      } catch(e) {
        mime = '';
      }
      saveAs(evt.currentTarget.response, `${title}_${new Date().getTime().toString()}.${mime}`);
      $router.hideLoading();
    }
    down.onprogress = (evt) => {
      if (evt.lengthComputable) {
        var percentComplete = evt.loaded / evt.total * 100;
        $router.showToast(`${percentComplete.toFixed(2)}%`);
      }
    }
    down.onerror = (err) => {
      $router.hideLoading();
      $router.showToast("Error DOWNLOAD");
    }
    down.send();
  }

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

  const editBookmarkPage = function($router, bookmark) {
    $router.push(
      new Kai({
        name: 'editBookmark',
        data: {
          title: bookmark.title,
          url: bookmark.url,
        },
        verticalNavClass: '.eBMNav',
        templateUrl: document.location.origin + '/templates/editBookmark.html',
        mounted: function() {
          this.$router.setHeaderTitle('Edit Bookmark');
        },
        unmounted: function() {},
        methods: {
          submit: function() {
            $router.showDialog('Confirm', 'Are you sure to save changes ?', null, 'Yes', () => {
              localforage.getItem('POCKET_BOOKMARKS')
              .then((bookmarks) => {
                if (bookmarks == null) {
                  bookmarks = [];
                }
                bookmarks.forEach(bm => {
                  if (bm.url === bookmark.url) {
                    const TITLE = document.getElementById('title');
                    const URL = document.getElementById('url');
                    if (TITLE.value.length > 0 && URL.value.length > 0) {
                      bm.title = TITLE.value;
                      bm.url = URL.value;
                    }
                  }
                });
                return localforage.setItem('POCKET_BOOKMARKS', bookmarks)
              })
              .then(() => {
                $router.pop();
              });
            }, 'No', () => {}, '', () => {}, () => {});
          }
        },
        softKeyText: { left: '', center: 'SELECT', right: '' },
        softKeyListener: {
          left: function() {},
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              if (listNav[this.verticalNavIndex]) {
                listNav[this.verticalNavIndex].click();
              }
            }
          },
          right: function() {}
        },
        dPadNavListener: {
          arrowUp: function() {
            this.navigateListNav(-1);
          },
          arrowDown: function() {
            this.navigateListNav(1);
          }
        }
      })
    );
  }

  const bookmarkManagerPage = new Kai({
    name: '_bookmarkManagerPage_',
    data: {
      title: '_bookmarkManagerPage_',
      bookmarks: [],
      keyword: null
    },
    verticalNavClass: '.bManNav',
    templateUrl: document.location.origin + '/templates/bookmarkManager.html',
    mounted: function() {
      this.$router.setHeaderTitle('Bookmark Manager');
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 100);
      this.methods.load();
    },
    unmounted: function() {},
    methods: {
      load: function() {
        this.data.keyword = null;
        localforage.getItem('POCKET_BOOKMARKS')
        .then((bookmarks) => {
          if (bookmarks == null) {
            bookmarks = [];
          }
          this.setData({ bookmarks: bookmarks});
        });
      },
      search: function(keyword) {
        this.verticalNavIndex = -1;
        if (keyword == null || keyword == '' || keyword.length == 0) {
          this.methods.load();
          return;
        }
        this.data.keyword = keyword;
        localforage.getItem('POCKET_BOOKMARKS')
        .then((bookmarks) => {
          if (bookmarks == null) {
            bookmarks = [];
          }
          const result = bookmarks.filter(bm => bm.title.toLowerCase().indexOf(keyword.toLowerCase()) >= 0 || bm.url.toLowerCase().indexOf(keyword.toLowerCase()) >= 0);
          this.setData({ bookmarks: result});
        });
      }
    },
    softKeyText: { left: 'Search', center: 'OPEN', right: 'More' },
    softKeyListener: {
      left: function() {
        const searchDialog = Kai.createDialog('Search', '<div><input id="search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        searchDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'Go');
            }, 103);
            const SEARCH_INPUT = document.getElementById('search-input');
            if (!SEARCH_INPUT) {
              return;
            }
            SEARCH_INPUT.focus();
            SEARCH_INPUT.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    setTimeout(() => {
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    SEARCH_INPUT.blur();
                    this.methods.search(SEARCH_INPUT.value);
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
        }
        searchDialog.dPadNavListener = {
          arrowUp: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          },
          arrowDown: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(searchDialog);
      },
      center: function() {
        if (this.verticalNavIndex > -1 && this.data.bookmarks.length > 0) {
          const f = this.data.bookmarks[this.verticalNavIndex];
          if (f) {
            this.$state.setState('target_url', f.url);
            this.$router.push('browser');
          }
        }
      },
      right: function() {
        if (this.verticalNavIndex > -1 && this.data.bookmarks.length > 0) {
          var current = this.data.bookmarks[this.verticalNavIndex];
          if (current) {
            var menus = [
              { "text": "Edit" },
              { "text": "Open with KaiOS Browser" },
              { "text": "Open with Reader View" },
              { "text": "Open with Reader View(TEXT)" },
              { "text": "Remove" }
            ];
            this.$router.showOptionMenu('Options', menus, 'Select', (selected) => {
              if (selected.text === 'Open with KaiOS Browser') {
                const KAIOS_BROWSER = window.open(current.url);
                startKaiOsBrowserTimer(KAIOS_BROWSER);
              } else if (selected.text === 'Open with Reader View' || selected.text === 'Open with Reader View(TEXT)'){
                readabilityPage(this.$router, current.url, current.title, false, selected.text === 'Open with Reader View(TEXT)');
              } else if (selected.text === 'Edit') {
                editBookmarkPage(this.$router, current);
              } else if (selected.text === 'Remove') {
                const URL = current.url;
                setTimeout(() => {
                  this.$router.showDialog('Confirm', 'Are you sure to remove ' + current.title + ' ?', null, 'Yes', () => {
                    localforage.getItem('POCKET_BOOKMARKS')
                    .then((bookmarks) => {
                      if (bookmarks == null) {
                        bookmarks = [];
                      }
                      const result = bookmarks.filter(bm => bm.url !== URL);
                      return localforage.setItem('POCKET_BOOKMARKS', result)
                    })
                    .then(() => {
                      this.methods.search(this.data.keyword);
                    });
                  }, 'No', () => {}, '', () => {}, () => {});
                }, 100);
              }
            }, () => {}, 0)
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const readabilityPage = function($router, url, title = '', save, textOnly = false, _cb = () => {}) {
    navigator.spatialNavigationEnabled = false;
    var hashids = new Hashids(url, 10);
    var id = hashids.encode(1);
    localforage.getItem('CONTENT___' + (validURL(url) ? id : url))
    .then((article) => {
      if (article != null) {
        if (textOnly)
          article = article.replace(/<img .*?>/g,"")
        setTimeout(() => {
          $router.showBottomSheet(new Kai({
            name: 'readabilityPage',
            data: {
              title: 'readabilityPage'
            },
            mounted: function() {
              setTimeout(() => {
                navigator.spatialNavigationEnabled = false;
              }, 100);
              document.addEventListener('keydown', this.methods.takeScreenshot);
            },
            unmounted: function() {
              document.removeEventListener('keydown', this.methods.takeScreenshot);
              document.getElementById('__readabilityPage__').scrollTop = 0;
              setTimeout(() => {
                document.getElementById('__readabilityPage__').remove();
              }, 100);
              _cb();
            },
            template: '<div id="__readabilityPage__" class="kui-flex-wrap" style="background-color:#fff;height:290px;overflow:hidden;padding:2px;"><style>img{width:100%;height:auto;}.kui-overlay-visible{z-index:10;}</style><h4 style="margin-bottom:5px;">' + title + '</h4><span id="articleBody" style="font-size: 100%;">' + article + '</span></div>',
            methods: {
              takeScreenshot: function(evt) {
                takeScreenshot(title, evt);
              }
            },
            dPadNavListener: {
              arrowRight: function() {},
              arrowUp: function() {
                document.getElementById('__readabilityPage__').scrollTop -= 20;
              },
              arrowLeft: function() {},
              arrowDown: function() {
                document.getElementById('__readabilityPage__').scrollTop += 20;
              },
            },
            softKeyListener: {
              left: function() {
                var current = parseInt(document.getElementById('articleBody').style.fontSize);
                current -= 10;
                if (current < 60)
                  return
                else
                  document.getElementById('articleBody').style.fontSize = `${current}%`
                $router.showToast(`${current}%`);
              },
              right: function() {
                var current = parseInt(document.getElementById('articleBody').style.fontSize);
                current += 10;
                if (current > 180)
                  return
                else
                  document.getElementById('articleBody').style.fontSize = `${current}%`
                $router.showToast(`${current}%`);
              }
            }
          }));
        }, 150);
      } else {
        $router.showLoading();
        getReaderable(url)
        .then((res) => {
          $router.hideLoading();
          if (textOnly)
            res.content = res.content.replace(/<img .*?>/g,"")
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
          $router.showBottomSheet(new Kai({
            name: 'readabilityPage',
            data: {
              title: 'readabilityPage'
            },
            mounted: function() {
              setTimeout(() => {
                navigator.spatialNavigationEnabled = false;
              }, 100);
              document.addEventListener('keydown', this.methods.takeScreenshot);
            },
            unmounted: function() {
              document.removeEventListener('keydown', this.methods.takeScreenshot);
              document.getElementById('__readabilityPage__').scrollTop = 0;
              setTimeout(() => {
                document.getElementById('__readabilityPage__').remove();
              }, 100);
              _cb();
            },
            template: '<div id="__readabilityPage__" class="kui-flex-wrap" style="background-color:#fff;height:290px;overflow:hidden;padding:2px;"><style>img{width:100%;height:auto;}.kui-overlay-visible{z-index:10;}</style><h4 style="margin-bottom:4px;">' + res.title + '</h4><span id="articleBody" style="font-size: 100%;">' + clean + '</span></div>',
            methods: {
              takeScreenshot: function(evt) {
                takeScreenshot(title, evt);
              }
            },
            dPadNavListener: {
              arrowRight: function() {},
              arrowUp: function() {
                document.getElementById('__readabilityPage__').scrollTop -= 20;
              },
              arrowLeft: function() {},
              arrowDown: function() {
                document.getElementById('__readabilityPage__').scrollTop += 20;
              },
            },
            softKeyListener: {
              left: function() {
                var current = parseInt(document.getElementById('articleBody').style.fontSize);
                current -= 10;
                if (current < 60)
                  return
                else
                  document.getElementById('articleBody').style.fontSize = `${current}%`
                $router.showToast(`${current}%`);
              },
              right: function() {
                var current = parseInt(document.getElementById('articleBody').style.fontSize);
                current += 10;
                if (current > 180)
                  return
                else
                  document.getElementById('articleBody').style.fontSize = `${current}%`
                $router.showToast(`${current}%`);
              }
            }
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

  const qrReader = function($router, cb = () => {}) {
    $router.showBottomSheet(
      new Kai({
        name: 'qrReader',
        data: {
          title: 'qrReader'
        },
        template: `<div class="kui-flex-wrap" style="overflow:hidden!important;height:264px;"><video id="qr_video" height="320" width="240" autoplay></video></div>`,
        mounted: function() {
          setTimeout(() => {
            navigator.spatialNavigationEnabled = false;
          }, 100);
          navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          .then((stream) => {
            const video = document.getElementById("qr_video");
            video.srcObject = stream;
            video.onloadedmetadata = (e) => {
              video.play();
              var barcodeCanvas = document.createElement("canvas");
              window['SCAN_QR'] = setInterval(() => {
                barcodeCanvas.width = video.videoWidth;
                barcodeCanvas.height = video.videoHeight;
                var barcodeContext = barcodeCanvas.getContext("2d");
                var imageWidth = Math.max(1, Math.floor(video.videoWidth)),imageHeight = Math.max(1, Math.floor(video.videoHeight));
                barcodeContext.drawImage(video, 0, 0, imageWidth, imageHeight);
                var imageData = barcodeContext.getImageData(0, 0, imageWidth, imageHeight);
                var idd = imageData.data;
                let code = jsQR(idd, imageWidth, imageHeight);
                if (code) {
                  cb(code.data);
                }
              }, 1000);
            };
          }).catch((err) => {
            $router.showToast(err.toString());
          });
        },
        unmounted: function() {
          cb(null);
          if (window['SCAN_QR']) {
            clearInterval(window['SCAN_QR']);
            window['SCAN_QR'] = null;
          }
          const video = document.getElementById("qr_video");
          const stream = video.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(function (track) {
            track.stop();
          });
          video.srcObject = null;
        },
        methods: {},
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {},
          center: function() {},
          right: function() {}
        },
        dPadNavListener: {
          arrowUp: function() {},
          arrowDown: function() {}
        }
      })
    );
  }

  const helpSupportPage = new Kai({
    name: 'helpSupportPage',
    data: {
      title: 'helpSupportPage'
    },
    templateUrl: document.location.origin + '/templates/helpnsupport.html',
    mounted: function() {
      this.$router.setHeaderTitle('Help & Support');
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 100);
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

  const changelogs = new Kai({
    name: 'changelogs',
    data: {
      title: 'changelogs'
    },
    templateUrl: document.location.origin + '/templates/changelogs.html',
    mounted: function() {
      this.$router.setHeaderTitle('Changelogs');
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
          localStorage.setItem('TEMP_REQUEST_TOKEN', REQUEST_TOKEN);
          var url = `https://getpocket.com/auth/authorize?request_token=${obj.code}&redirect_uri=${params.redirect_uri}&mobile=1`;
          var auth_screen = window.open(url);
          var auth_screen_timer = setInterval(() => {
            if (auth_screen.closed) {
              clearInterval(auth_screen_timer);
              auth_screen_timer = null;
              const TEMP_POCKET_ACCESS_TOKEN = localStorage.getItem('TEMP_POCKET_ACCESS_TOKEN');
              if (TEMP_POCKET_ACCESS_TOKEN != null) {
                var obj = JSON.parse(TEMP_POCKET_ACCESS_TOKEN);
                localforage.setItem('POCKET_ACCESS_TOKEN', obj)
                .finally(() => {
                  localStorage.removeItem('TEMP_REQUEST_TOKEN');
                  localStorage.removeItem('TEMP_POCKET_ACCESS_TOKEN');
                  $router.showToast('Success');
                  window.location.reload()
                });
              } else {
                localStorage.removeItem('TEMP_REQUEST_TOKEN');
                localStorage.removeItem('TEMP_POCKET_ACCESS_TOKEN');
                $router.showToast('Unknown Error');
              }
            }
          }, 500);
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
    mounted: function() {
      this.$router.setHeaderTitle('Offline Reader View');
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 100);
      this.methods.getArticles();
    },
    unmounted: function() {
      this.data.articles = []
    },
    verticalNavClass: '.offlineArticlesNav',
    templateUrl: document.location.origin + '/templates/offlineArticles.html',
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
              } else {
                this.$router.setSoftKeyText('', '', '')
              }
              this.setData({
                articles: articles,
                empty: (articles.length === 0 ? true : false)
              });
            }
          }
        });
      },
      renderSoftKeyText: function() {
        setTimeout(() => {
          if (this.data.articles.length > 0) {
            this.$router.setSoftKeyText('Delete', 'OPEN', 'Options')
          } else {
            this.$router.setSoftKeyText('', '', '')
          }
        }, 100);
      }
    },
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
        if (this.data.articles.length > 0) {
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
          }, 'No', () => {}, '', () => {}, () => {
            this.methods.renderSoftKeyText();
          });
        }
      },
      center: function() {
        if (this.data.articles.length > 0) {
          var current = this.data.articles[this.verticalNavIndex];
          readabilityPage(this.$router, current.hashid, current.title, false, false, this.methods.renderSoftKeyText);
        }
      },
      right: function() {
        if (this.data.articles.length > 0) {
          var current = this.data.articles[this.verticalNavIndex];
          var menus = [
            { "text": "Open with built-in browser" },
            { "text": "Open with KaiOS Browser" },
            { "text": "Open with Reader View(TEXT)" }
          ];
          this.$router.showOptionMenu('Options', menus, 'Select', (selected) => {
            if (selected.text === 'Open with built-in browser') {
              this.$state.setState('target_url', current.url);
              this.$router.push('browser');
            } else if (selected.text === 'Open with KaiOS Browser') {
              const KAIOS_BROWSER = window.open(current.url);
              startKaiOsBrowserTimer(KAIOS_BROWSER);
            } else if (selected.text === 'Open with Reader View(TEXT)'){
              readabilityPage(this.$router, current.hashid, current.title, false, true, this.methods.renderSoftKeyText);
            }
          }, () => {
            this.methods.renderSoftKeyText();
          }, 0)
        }
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
      } else if (!validURL(TARGET_URL) && TARGET_URL.indexOf('blob:app://') === -1) {
        TARGET_URL = 'https://www.google.com/search?q=' + TARGET_URL;
      }
      // console.log(TARGET_URL);
      this.$state.setState('target_url', TARGET_URL);
      currentTab = new Tab(TARGET_URL);
      currentTab.iframe.setAttribute('style', 'position:fixed;margin-top:0px;top:0;height:101%;width:100%;');
      currentTab.iframe.setAttribute('frameBorder', '0');
      if (this.$state.getState('disableJS')) {
        currentTab.iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation');
      }
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
        if (event.detail.type === 'other')
          this.$router.showToast('Menu > Open with KaiOS Browser');
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
              const _URL = document.getElementById('url-input');
              if (_URL != null) {
                _URL.focus();
                evt.preventDefault();
                evt.stopPropagation();
              }
              break
            case '1':
              if (this.data.zoom > 0.25 && !this.$router.bottomSheet) {
                this.data.zoom -= 0.25;
                window['currentTab'].iframe.zoom(this.data.zoom);
              }
              break
            case '2':
              this.data.zoom = 1;
              window['currentTab'].iframe.zoom(this.data.zoom);
              break
            case '3':
              if (this.data.zoom < 3 && !this.$router.bottomSheet) {
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
        const root = document.getElementsByTagName( 'html' )[0];
        const blueFilter = root.classList.contains('blue-filter');
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
              var menus = [];
              menus.push({ "text": "Download Content" });
              if (this.data.loading) {
                menus.push({ "text": "Stop" });
              } else {
                menus.push({ "text": "Refresh" });
              }
              if (menu.isLoggedIn) {
                menus.push({ "text": "Save to GetPocket" });
              }
              menus.push({ "text": "Open with KaiOS Browser" });
              menus.push({ "text": "Open with Reader View" });
              menus.push({ "text": "Open with Reader View(TEXT)" });
              if (menu.savedArticle) {
                menus.push({ "text": "Delete Reader View" });
              } else {
                menus.push({ "text": "Save Reader View" });
              }
              if (menu.canBack) {
                menus.push({ "text": "Go Back" });
              }
              if (menu.canForward) {
                menus.push({ "text": "Go Forward" });
              }
              if (menu.bookmark) {
                menus.push({ "text": "Remove Bookmark" });
              } else {
                menus.push({ "text": "Add Bookmark" });
              }
              menus.push({ "text": "Bookmarks" });
              menus.push({ "text": "History" });
              menus.push({ "text": "Clear History" });
              menus.push({ "text": (blueFilter ? 'Turn Off' : 'Turn On') + ' Bluelight Filter' });
              menus.push({ "text": 'Share URL' });
              menus.push({ "text": 'Scan QR Code' });
              menus.push({ "text": 'Generate QR Code' });
              menus.push({ "text": "Volume Control" });
              menus.push({ "text": "Quit" });
              sk.classList.remove("sr-only");
              navigator.spatialNavigationEnabled = false;
              this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
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
                } else if (selected.text === 'Bookmarks') {
                  localforage.getItem('POCKET_BOOKMARKS')
                  .then((bookmarks) => {
                    if (bookmarks == null) {
                      bookmarks = [];
                    }
                    if (bookmarks.length == 0) {
                      this.$router.showToast('Empty');
                    } else {
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
                  });
                } else if (selected.text === 'History') {
                  localforage.getItem('POCKET_HISTORY')
                  .then((history) => {
                    if (history == null) {
                      history = [];
                    }
                    if (history.length == 0) {
                      this.$router.showToast('Empty');
                    } else {
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
                } else if (selected.text ===  'Open with KaiOS Browser') {
                  const KAIOS_BROWSER = window.open(window['currentTab'].url.url);
                  startKaiOsBrowserTimer(KAIOS_BROWSER);
                } else if (selected.text === 'Open with Reader View' || selected.text === 'Open with Reader View(TEXT)') {
                  var hashids = new Hashids(window['currentTab'].url.url, 10);
                  var id = hashids.encode(1);
                  localforage.getItem('ARTICLES')
                  .then((articles) => {
                    if (articles == null) {
                      articles = [];
                    }
                    var filtered = [];
                    filtered = articles.filter(function(a) {
                      return a.hashid == id;
                    });
                    if (filtered.length > 0) {
                      readabilityPage(this.$router, window['currentTab'].url.url, filtered[0].title, false, selected.text === 'Open with Reader View(TEXT)', () => {
                        navigator.spatialNavigationEnabled = true;
                        const sk = document.getElementById('__kai_soft_key__');
                        sk.classList.add("sr-only");
                        const kr = document.getElementById('__kai_router__');
                        kr.classList.add("full-screen-browser");
                      });
                    } else {
                      readabilityPage(this.$router, window['currentTab'].url.url, 'UNKNOWN', false, selected.text === 'Open with Reader View(TEXT)', () => {
                        navigator.spatialNavigationEnabled = true;
                        const sk = document.getElementById('__kai_soft_key__');
                        sk.classList.add("sr-only");
                        const kr = document.getElementById('__kai_router__');
                        kr.classList.add("full-screen-browser");
                      });
                    }
                  })
                } else if (selected.text === 'Save Reader View') {
                  readabilityPage(this.$router, window['currentTab'].url.url, '', true, false, () => {
                    navigator.spatialNavigationEnabled = true;
                    const sk = document.getElementById('__kai_soft_key__');
                    sk.classList.add("sr-only");
                    const kr = document.getElementById('__kai_router__');
                    kr.classList.add("full-screen-browser");
                  });
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
                } else if (selected.text === 'Download Content') {
                  var _title = window['currentTab'].title;
                  downloadURL(this.$router, this.$state.getState('target_url'), typeof _title === 'string' ? _title : 'Unknown');
                } else if (selected.text === 'Volume Control') {
                  setTimeout(() => {
                    navigator.volumeManager.requestShow();
                    navigator.spatialNavigationEnabled = false;
                    VOLUME_CONTROL_TIMER = setTimeout(() => {
                      navigator.spatialNavigationEnabled = true;
                      VOLUME_CONTROL_TIMER = null;
                    }, 2000);
                  }, 100);
                }  else if (selected.text === 'Turn Off Bluelight Filter' || selected.text === 'Turn On Bluelight Filter') {
                  if (blueFilter)
                    root.classList.remove('blue-filter')
                  else
                    root.classList.add('blue-filter')
                } else if (selected.text === 'Scan QR Code') {
                  qrReader(this.$router, (str) => {
                    this.$router.hideBottomSheet();
                    sk.classList.add("sr-only");
                    navigator.spatialNavigationEnabled = true;
                    if (str) {
                      this.$state.setState('target_url', str);
                      var _url = this.$state.getState('target_url');
                      if (_url === '') {
                        _url = 'https://www.google.com/';
                      } else if (!validURL(_url)) {
                        _url = 'https://www.google.com/search?q=' + _url;
                      }
                      window['currentTab'].iframe.src = _url;
                    }
                  });
                }  else if (selected.text === 'Generate QR Code') {
                  this.$router.showDialog('QR CODE', `<div id="qrcode" style="margin-left:3px;"></div>`, null, ' ', () => {}, 'Close', () => {}, ' ', () => {}, () => {
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
                  setTimeout(() => {
                    new QRCode(document.getElementById("qrcode"), {
                      text: window['currentTab'].url.url,
                      width: 225,
                      height: 225,
                      colorDark : "#000000",
                      colorLight : "#ffffff",
                      correctLevel : QRCode.CorrectLevel.H
                    });
                  }, 50);
                } else if (selected.text === 'Share URL') {
                  setTimeout(() => {
                    navigator.spatialNavigationEnabled = false;
                  }, 110);
                  const share = new MozActivity({
                    name: "new",
                    data: {
                      type: "websms/sms",
                      body: window['currentTab'].url.url,
                    }
                  });
                  share.onsuccess = () => {
                    setTimeout(() => {
                      navigator.spatialNavigationEnabled = true;
                    }, 500);
                  }
                  share.onerror = () => {
                    setTimeout(() => {
                      navigator.spatialNavigationEnabled = true;
                    }, 500);
                  }
                } else if (selected.text === 'Quit') {
                  this.$state.setState('target_url', '');
                  this.$router.pop();
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
        const urlDialog = Kai.createDialog('URL/Google Search', '<div><input id="url-input" type="text" placeholder="Enter URL/Google Search" class="kui-input"/></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        urlDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'Go');
            }, 103);
            const _URL = document.getElementById('url-input');
            if (!URL) {
              return;
            }
            _URL.focus();
            var _temp = this.$state.getState('target_url');
            if (_temp.indexOf('https://www.google.') > -1) {
              const q = getURLParam('q', _temp);
              if (q.length > 0) {
                _temp = q[0].split('+');
                _temp = decodeURIComponent(_temp.join(' '));
                //console.log(q[0], _temp);
              } else {
                if (_temp.split('/').length === 4) {
                  _temp = '';
                }
              }
            }
            _URL.value = _temp;
            _URL.setSelectionRange(0, _URL.value.length);
            _URL.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    sk.classList.add("sr-only");
                    setTimeout(() => {
                      _URL.blur();
                      navigator.spatialNavigationEnabled = true;
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  sk.classList.add("sr-only");

                  var TARGET_URL = _URL.value;
                  if (!validURL(TARGET_URL)) {
                    TARGET_URL = 'https://www.google.com/search?q=' + TARGET_URL;
                  }
                  this.$state.setState('target_url', TARGET_URL);
                  window['currentTab'].iframe.src = TARGET_URL;
                  setTimeout(() => {
                    _URL.blur();
                    navigator.spatialNavigationEnabled = true;
                    this.$router.hideBottomSheet();
                  }, 100);
                  break
                case 'SoftLeft':
                  sk.classList.add("sr-only");
                  setTimeout(() => {
                    _URL.blur();
                    navigator.spatialNavigationEnabled = true;
                    this.$router.hideBottomSheet();
                  }, 100);
                  break
              }
            });
          });
        }
        urlDialog.dPadNavListener = {
          arrowUp: function() {
            const _URL = document.getElementById('url-input');
            _URL.focus();
          },
          arrowDown: function() {
            const _URL = document.getElementById('url-input');
            _URL.focus();
          }
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

  const localHTML = new Kai({
    name: 'localHTML',
    data: {
      title: 'localHTML',
      files: []
    },
    verticalNavClass: '.localHTML',
    templateUrl: document.location.origin + '/templates/localHTML.html',
    mounted: function() {
      this.$router.setHeaderTitle('Local HTML');
      this.$router.setSoftKeyCenterText('OPEN');
      localforage.getItem('FILES')
      .then((files) => {
        if (!files) {
          window['__DS__'] = new DataStorage(this.methods.onChange, this.methods.onReady);
          setTimeout(() => {
            this.$router.showToast('Please `Kill App` if you think the app was hang');
          }, 30000);
        } else {
          files.forEach((file) => {
            if (file.id == null) {
              const hashids2 = new Hashids(file.path, 15);
              const _vid = hashids2.encode(1);
              file.id = _vid;
            }
            if (file.location == null) {
              const _paths = file.path.split('/');
              _paths.pop();
              file.location = _paths.length === 0 ? 'root' : _paths.join('/');
            }
          });
          this.setData({files: files});
        }
      });
    },
    unmounted: function() {
      if (window['__DS__']) {
        window['__DS__'].destroy();
      }
    },
    methods: {
      selected: function() {},
      onChange: function(fileRegistry, documentTree, groups) {
        const current = this.$router.stack[this.$router.stack.length - 1].name;
        if (current !== 'localHTML') {
          return
        }
        this.methods.runFilter(fileRegistry || []);
      },
      onReady: function(status) {
        if (status) {
          this.$router.hideLoading();
        } else {
          this.$router.showLoading(false);
        }
      },
      runFilter: function(fileRegistry) {
        var files = []
        fileRegistry.forEach((file) => {
          var n = file.split('/');
          var n1 = n[n.length - 1];
          var exts = n1.split('.');
          if (exts.length > 1) {
            const ext = exts[exts.length - 1];
            if (['html'].indexOf(ext) > -1) {
              const hashids2 = new Hashids(file, 15);
              const _vid = hashids2.encode(1);
              n.pop();
              files.push({ 'name': n1, 'path': file, id: _vid, location: (n.length === 0 ? 'root' : n.join('/')) });
            }
          }
        });
        files.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
        this.setData({files: files});
        localforage.setItem('FILES', files);
      },
      search: function(keyword) {
        this.verticalNavIndex = -1;
        localforage.getItem('FILES')
        .then((files) => {
          if (!files) {
            files = [];
          }
          var result = [];
          files.forEach((file) => {
            if (keyword === '' || (file.name.toLowerCase().indexOf(keyword.toLowerCase()) > -1)) {
              result.push(file);
            }
          });
          result.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
          this.setData({files: result});
        });
      }
    },
    softKeyText: { left: 'Menu', center: 'OPEN', right: 'Kill App' },
    softKeyListener: {
      left: function() {
        var menu = [
          {'text': 'Search'},
          {'text': 'Reload Library'},
        ]
        this.$router.showOptionMenu('Menu', menu, 'SELECT', (selected) => {
          if (selected.text === 'Reload Library') {
            this.verticalNavIndex = -1;
            if (window['__DS__']) {
              window['__DS__'].destroy();
            }
            window['__DS__'] = new DataStorage(this.methods.onChange, this.methods.onReady);
          } else if (selected.text === 'Search') {
            const searchDialog = Kai.createDialog('Search', '<div><input id="search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
            searchDialog.mounted = () => {
              setTimeout(() => {
                setTimeout(() => {
                  this.$router.setSoftKeyText('Cancel' , '', 'Go');
                }, 103);
                const SEARCH_INPUT = document.getElementById('search-input');
                if (!SEARCH_INPUT) {
                  return;
                }
                SEARCH_INPUT.focus();
                SEARCH_INPUT.addEventListener('keydown', (evt) => {
                  switch (evt.key) {
                    case 'Backspace':
                    case 'EndCall':
                      if (document.activeElement.value.length === 0) {
                        this.$router.hideBottomSheet();
                        setTimeout(() => {
                          SEARCH_INPUT.blur();
                        }, 100);
                      }
                      break
                    case 'SoftRight':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        SEARCH_INPUT.blur();
                        this.methods.search(SEARCH_INPUT.value);
                      }, 100);
                      break
                    case 'SoftLeft':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        SEARCH_INPUT.blur();
                      }, 100);
                      break
                  }
                });
              });
            }
            searchDialog.dPadNavListener = {
              arrowUp: function() {
                const SEARCH_INPUT = document.getElementById('search-input');
                SEARCH_INPUT.focus();
              },
              arrowDown: function() {
                const SEARCH_INPUT = document.getElementById('search-input');
                SEARCH_INPUT.focus();
              }
            }
            this.$router.showBottomSheet(searchDialog);
          }
        }, null);
      },
      center: function() {
        var file = this.data.files[this.verticalNavIndex];
        if (file) {
          var DS;
          if (window['__DS__']) {
            DS = window['__DS__'];
          }
          else {
            DS = new DataStorage(() => {}, () => {}, false);
          }
          DS.getFile(file.path, (blob) => {
            const _url = URL.createObjectURL(blob);
            if (window['BLOB_URL'] == null)
              window['BLOB_URL'] = [];
            window['BLOB_URL'].push(_url);
            this.$state.setState('target_url', _url);
            this.$router.push('browser');
          }, (err) => {
            this.$router.showToast(err.toString());
          })
        }
      },
      right: function() {
        window.close();
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        //this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        //this.navigateTabNav(1);
      },
    },
    backKeyListener: function() {}
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
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 100);
      localforage.getItem('APP_VERSION')
      .then((v) => {
        if (v == null || v != APP_VERSION) {
          this.$router.showToast('Read about new updates');
          this.$router.push('changelogs');
          localforage.setItem('APP_VERSION', APP_VERSION)
        } else {
          localforage.getItem('POCKET_ACCESS_TOKEN')
          .then((POCKET_ACCESS_TOKEN) => {
            if (POCKET_ACCESS_TOKEN != null) {
              this.setData({ POCKET_ACCESS_TOKEN: POCKET_ACCESS_TOKEN });
              if (this.data.offset === -1) {
                this.methods.loadArticles(0);
              } else {
                if (this.data.articles.length > 0) {
                  if (!this.$router.bottomSheet)
                    this.$router.setSoftKeyRightText('More');
                }
              }
            }
          });
        }
      });
      if (window['BLOB_URL']) {
        window['BLOB_URL'].forEach((u) => {
          URL.revokeObjectURL(u);
        });
        window['BLOB_URL'] = [];
      }
      localforage.getItem('DISABLE_JAVASCRIPT')
      .then((js_status) => {
        if (js_status == null)
          js_status = false;
        this.$state.setState('disableJS', js_status);
      });
      localforage.getItem('BLUELIGHT_FILTER')
      .then((blueFilter) => {
        if (blueFilter == null)
          blueFilter = false;
        const root = document.getElementsByTagName( 'html' )[0];
        if (blueFilter)
          root.classList.add('blue-filter')
        else
          root.classList.remove('blue-filter')
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
                  } else if (arr[i][1].domain_metadata) {
                    arr[i][1]['preview'] = arr[i][1].domain_metadata.logo;
                  } else {
                    arr[i][1]['preview'] = '/img/login.png';
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
                  if (!this.$router.bottomSheet)
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
      renderSoftkeyRight: function() {
        if (this.data.articles.length > 0) {
          if (!this.$router.bottomSheet)
            this.$router.setSoftKeyRightText('More');
        } else {
          this.$router.setSoftKeyRightText('');
        }
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
        localforage.getItem('DISABLE_JAVASCRIPT')
        .then((js_status) => {
          if (js_status == null)
            js_status = false;
          this.$state.setState('disableJS', js_status);
          return localforage.getItem('POCKET_ACCESS_TOKEN');
        })
        .then((res) => {
          const root = document.getElementsByTagName( 'html' )[0];
          const JS = this.$state.getState('disableJS') ? 'Enable Javascript' : 'Disable Javascript';
          const blueFilter = root.classList.contains('blue-filter');
          var title = 'Menu';
          var menu = [];
          if (res) {
            title = res.username;
            menu.push({ "text": "Refresh" });
          } else {
            menu.push({ "text": "Login" });
          }
          menu.push(
            { "text": "Web Browser" },
            { "text": "Scan QR Code" },
            { "text": "Offline Reader View" },
            { "text": "Local HTML" },
            { "text": "Bookmarks" },
            { "text": "Bookmark Manager" },
            { "text": "History" },
            { "text": "Clear History" },
            { "text": (blueFilter ? 'Turn Off' : 'Turn On') + ' Bluelight Filter' },
            { "text": JS },
            { "text": "Changelogs" },
            { "text": "Help & Support" }
          );
          if (res) {
            menu.push({ "text": "Logout" });
          }
          menu.push({ "text": "Kill App" });
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            setTimeout(() => {
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
                  if (bookmarks == null) {
                    bookmarks = [];
                  }
                  if (bookmarks.length == 0) {
                    this.$router.showToast('Empty');
                  } else {
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
                });
              } else if (selected.text == 'Bookmark Manager') {
                this.$router.push('bookmarkManagerPage');
              } else if (selected.text === 'History') {
                localforage.getItem('POCKET_HISTORY')
                .then((history) => {
                  if (history == null) {
                    history = [];
                  }
                  if (history.length == 0) {
                    this.$router.showToast('Empty');
                  } else {
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
                          if (this.data.articles[this.verticalNavIndex]) {
                            if (this.data.articles[this.verticalNavIndex].isArticle) {
                              this.$router.setSoftKeyRightText('More');
                            } else {
                              this.$router.setSoftKeyRightText('');
                            }
                          }
                        }
                      }, 100);
                    }, 0);
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
              } else if (selected.text ===  'Changelogs') {
                this.$router.push('changelogs');
              } else if (selected.text === 'Offline Reader View') {
                setTimeout(() => {
                  this.$router.push('offlineArticles');
                }, 110);
              } else if (selected.text === 'Kill App') {
                window.close();
              } else if (selected.text === 'Enable Javascript' || selected.text === 'Disable Javascript') {
                this.$state.setState('disableJS', !this.$state.getState('disableJS'));
                localforage.setItem('DISABLE_JAVASCRIPT', this.$state.getState('disableJS'));
                this.$router.showToast(this.$state.getState('disableJS') ? 'Javascript disabled' : 'Javascript enabled');
              } else if (selected.text === 'Turn Off Bluelight Filter' || selected.text === 'Turn On Bluelight Filter') {
                if (blueFilter) {
                  localforage.setItem('BLUELIGHT_FILTER', false);
                  root.classList.remove('blue-filter')
                } else {
                  localforage.setItem('BLUELIGHT_FILTER', true);
                  root.classList.add('blue-filter');
                }
              } else if (selected.text === 'Scan QR Code') {
                qrReader(this.$router, (str) => {
                  this.$router.hideBottomSheet();
                  if (str) {
                    this.$state.setState('target_url', str);
                    setTimeout(() => {
                      this.$router.push('browser');
                    }, 200);
                  }
                });
              } else if (selected.text === 'Local HTML') {
                this.$router.push('localHTML');
              }
            }, 100);
          }, () => {
            setTimeout(() => {
              if (!this.$router.bottomSheet && this.$router.stack[this.$router.stack.length - 1].name === 'homepage') {
                if (this.data.articles[this.verticalNavIndex]) {
                  if (this.data.articles[this.verticalNavIndex].isArticle) {
                    this.$router.setSoftKeyRightText('More');
                  } else {
                    this.$router.setSoftKeyRightText('');
                  }
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
        var title = 'More';
        var menu = [
          { "text": "Open with built-in browser" },
          { "text": "Open with KaiOS Browser" },
          { "text": "Open with Reader View" },
          { "text": "Open with Reader View(TEXT)" },
          { "text": "Save Reader View" },
          { "text": "Delete" }
        ];
        var current = this.data.articles[this.verticalNavIndex];
        var hashids = new Hashids(current.given_url, 10);
        var id = hashids.encode(1);
        localforage.getItem('CONTENT___' + id)
        .then((article) => {
          if (article != null) {
            menu[4] = { "text": "Delete Reader View" }
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            setTimeout(() => {
              if (selected.text === 'Open with built-in browser') {
                this.$state.setState('target_url', current.given_url);
                this.$router.push('browser');
              } else if (selected.text === 'Open with KaiOS Browser') {
                const KAIOS_BROWSER = window.open(current.given_url);
                startKaiOsBrowserTimer(KAIOS_BROWSER);
              } else if (selected.text === 'Delete') {
                this.methods.deleteArticle();
              } else if (selected.text === 'Open with Reader View' || selected.text === 'Open with Reader View(TEXT)') {
                readabilityPage(this.$router, current.given_url, current.resolved_title, false, selected.text === 'Open with Reader View(TEXT)');
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
      },
      'changelogs': {
        name: 'changelogs',
        component: changelogs
      },
      'localHTML': {
        name: 'localHTML',
        component: localHTML
      },
      'bookmarkManagerPage': {
        name: 'bookmarkManagerPage',
        component: bookmarkManagerPage
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

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'k-pocket-browser',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  function startKaiOsBrowserTimer(KAIOS_BROWSER) {
    KAIOS_BROWSER_TIMER = setInterval(() => {
      const browser = app.$router.stack[app.$router.stack.length - 1];
      if (KAIOS_BROWSER.closed && browser.name === 'browser') {
        navigator.spatialNavigationEnabled = true;
        clearInterval(KAIOS_BROWSER_TIMER);
        KAIOS_BROWSER_TIMER = null;
      } else if (KAIOS_BROWSER.closed) {
        navigator.spatialNavigationEnabled = false;
        clearInterval(KAIOS_BROWSER_TIMER);
        KAIOS_BROWSER_TIMER = null;
      }
    }, 500);
  }

  var EXIT_STACK = 0;
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Call') {
      if (window['exittimer'])
        clearTimeout(window['exittimer']);
      EXIT_STACK += 1;
      if (EXIT_STACK === 3)
        window.close();
      window['exittimer'] = setTimeout(() => {
        EXIT_STACK = 0;
        window['exittimer'] = null;
      }, 300);
    }
  });

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
      displayKaiAds();
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
