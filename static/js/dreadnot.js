


function streamLogs(log) {
  var logPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'log'].join('/');
      dest = $('pre.deployment_log');

  function pushEntry(entry) {
    var scroll = Math.abs(dest[0].scrollTop - (dest[0].scrollHeight - dest[0].offsetHeight)) < 10,
        line, table;

    if (entry.lvl <= 3) {
      line = $('<p class="error">' + entry.msg + '</p>');
    } else {
      line = $('<p>' + entry.msg + '</p>');
    }

    table = $('<div class="bordered-table condensed-table"><table><tbody>' + Object.keys(entry.obj).map(function(key) {
      var val;

      if (key === 'err') {
        val = entry.obj[key].stack;
      } else {
        val = entry.obj[key];
      }

      // convert ansi color codes to html
      try {
        val = ansi_up.ansi_to_html(val);
      }
      catch (err) { }

      return '<tr><td class="key">' + key + '</td><td>' + val + '</td></tr>';
    }).join('') + '</tbody></table></div>');

    line.click(function() {
      table.slideToggle('fast', 'swing');
    });

    dest.append(line);
    dest.append(table);

    if (scroll) {
      dest[0].scrollTop = dest[0].scrollHeight;
    }
  }

  function loadFrom(idx) {
    $.get('/' + logPath + '?from=' + idx, function(data) {
      var done = false, success;

      data.forEach(function(entry) {
        if (typeof entry !== 'boolean') {
          pushEntry(entry);
        } else {
          done = true;
          $('pre.deployment_log p').last().addClass(entry ? 'success' : 'error');
        }
      });

      if (!done) {
        loadFrom(idx + data.length);
      }
    });
  }

  loadFrom(0);
}


function dreadNow() {
  $('#dread-now').modal({
    keyboard: true,
    backdrop: 'static'
  });

  $('#deploy-form').submit(function(event) {
    if ($('#wack').val() !== 'true') {
      event.preventDefault();
      $('#dread-now').modal('show');
    } else {
      return true;
    }
  });

  $('#fearless').click(function(event) {
    $('#dread-now').modal('hide');
    $('#wack').val('true');
    $('#deploy-form').submit();
  });

  $('#fearful').click(function(event) {
    $('#dread-now').modal('hide');
  });
}
