
// Bind handlers when the page loads.
$(function() {
  $('.g-signin2').click(function() {
    $('#spinner').removeClass('d-none');
  });
});


function showError(error) {
  console.log(error);
  var alert_box = $('.alert');
  alert_box.addClass('alert-danger');
  $(".message").text(error);

}

function showMessage(message) {
  var alert_box = $('.alert');
  alert_box.removeClass('alert-danger');
  alert_box.addClass('alert-success');
  $(".message").text(message);
}

// TODO: Add Google Sign-in.
function onSignIn(user) {
  $('#spinner').addClass('d-none');
  var profile = user.getBasicProfile();
  $('#profile .name').text(profile.getName());
  $('#profile .email').text(profile.getEmail());
}

// TODO: Add spreadsheet control handlers.
$(function() {
  $('button[rel="create"]').click(function() {
    makeRequest('POST', '/spreadsheets', function(err, spreadsheet) {
      if (err) return showError(err);
      window.location.reload();
    });
  });
  $('button[rel="sync"]').click(function() {
    var spreadsheetId = $(this).data('spreadsheetid');
    var url = '/spreadsheets/' + spreadsheetId + '/sync';
    makeRequest('POST', url, function(err) {
      if (err) return showError(err);
      showMessage('Sync complete.');
    });
  });
});

function makeRequest(method, url, callback) {
  var auth = gapi.auth2.getAuthInstance();
  if (!auth.isSignedIn.get()) {
    return callback(new Error('Signin required.'));
  }
  var accessToken = auth.currentUser.get().getAuthResponse().access_token;
  $('#spinner').removeClass('d-none');
  $.ajax(url, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    success: function(response) {
      $('#spinner').addClass('d-none');
      return callback(null, response);
    },
    error: function(response) {
      return callback(new Error(response.responseJSON.message));
    }
  });
}
