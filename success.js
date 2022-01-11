window.addEventListener("load", function() {
  var TEMP_REQUEST_TOKEN = localStorage.getItem('TEMP_REQUEST_TOKEN');
  var oauthAuthorize = new XMLHttpRequest({ mozSystem: true });
  var params = {
    "consumer_key": "94872-b408e0508baaa3a6658564f3",
    "code": TEMP_REQUEST_TOKEN
  };
  oauthAuthorize.open('POST', 'https://getpocket.com/v3/oauth/authorize', true);
  oauthAuthorize.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  oauthAuthorize.setRequestHeader("X-Accept", 'application/json');
  oauthAuthorize.onreadystatechange = function() {
    if(oauthAuthorize.readyState == 4 && oauthAuthorize.status == 200) {
      if (oauthAuthorize.response) {
        var obj = JSON.parse(oauthAuthorize.response);
        localStorage.setItem('TEMP_POCKET_ACCESS_TOKEN', oauthAuthorize.response);
        alert('Success, click Cancel to continue');
      } else {
        alert('Invalid response, click Cancel to continue');
      }
    } else if (oauthAuthorize.status >= 400 && oauthAuthorize.status <= oauthAuthorize.status <= 599) {
      alert(`Error ${oauthAuthorize.status}, click Cancel to continue`);
    }
  }
  oauthAuthorize.send(JSON.stringify(params));
});
