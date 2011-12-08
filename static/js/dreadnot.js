


function streamLogs(log) {
  var socket = io.connect(),
      logPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'log'].join('.'),
      endPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'end'].join('.');

  socket.on(logPath, function(entry) {
    var dest = $('pre.deployment_log'),
        scroll = Math.abs(dest[0].scrollTop - (dest[0].scrollHeight - dest[0].offsetHeight)) < 10;

    if (entry.lvl <= 3) {
      dest.append('<p class="error">' + entry.msg + '</p>');
    } else {
      dest.append('<p>' + entry.msg + '</p>');
    }

    if (scroll) {
      dest[0].scrollTop = dest[0].scrollHeight;
    }
  });

  socket.on(endPath, function(success) {
    var last = $('pre.deployment_log p').last();

    if (success) {
      last.addClass('success');
    } else {
      last.addClass('error');
    }
  });

  socket.once('connect', function() {
    socket.emit('request log', log);
  });
}
