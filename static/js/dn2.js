(function($) {
  var backend = {
    _getItem: function(relPath, ModelClass, callback) {
      $.ajax('/api/1.0/' + relPath, {
        type: 'GET',
        contentType: 'application/json',
        success: function(item) {
          callback(null, new ModelClass(item));
        },
        error: function(res) {
          callback(JSON.parse(res.responseText));
        }
      });
    },

    _getItems: function(relPath, ModelClass, callback) {
      $.ajax('/api/1.0/' + relPath, {
        type: 'GET',
        contentType: 'application/json',
        success: function(items) {
          callback(null, items.map(function(item) { return new ModelClass(item); }));
        },
        error: function(res) {
          callback(JSON.parse(res.responseText));
        }
      });
    },

    getDreadnot: function(callback) {
      backend._getItem('', Dreadnot, callback);
    },

    getStacks: function(callback) {
      backend._getItems('stacks', Stack, callback);
    },

    getStack: function(stackName, callback) {
      backend._getItem('stacks/' + stackName, Stack, callback);
    },

    getRegions: function(stackName, callback) {
      backend._getItems('stacks/' + stackName + '/regions', Region, callback);
    },

    getRegion: function(stackName, regionName, callback) {
      backend._getItem('stacks/' + stackName + '/regions/' + regionName, Region, callback);
    },

    getDeployments: function(stackName, regionName, callback) {
      var url = ['stacks', stackName, 'regions', regionName, 'deployments'].join('/');
      backend._getItems(url, Deployment, callback);
    },

    getDeployment: function(stackName, regionName, deploymentName, callback) {
      var url = ['stacks', stackName, 'regions', regionName, 'deployments', deploymentName].join('/');
      backend._getItem(url, Deployment, callback);
    },

    getLog: function(stackName, regionName, deploymentName, from, callback) {
      $.ajax('/api/1.0/' + relPath, {
        type: 'GET',
        contentType: 'application/json',
        success: function(item) {
          callback(null, new ModelClass(item));
        },
        error: function(res) {
          callback(JSON.parse(res.responseText));
        }
      });
    }

  };

  var Dreadnot = Backbone.Model.extend({
    url: '/api/1.0'
  });

  var Stack = Backbone.Model.extend({
    initialize: function() {
      _.bindAll(this, 'getCommitLink')
    },

    _commitLinkTemplate: _.template(
      '<a href="<%= github_href %>/commit/<%= rev %>"><%= trimmed %></a>'
    ),

    _diffLinkTemplate: _.template(
      '<% if (reva !== revb)  { %>' +
        '(<a href="<%= github_href %>/compare/<%= reva %>...<%= revb %>">diff</a>)' +
      '<% } %>'
    ),

    getCommitLink: function(rev) {
      return this._commitLinkTemplate({
        github_href: this.get('github_href'),
        trimmed: rev.slice(0, 7),
        rev: rev
      });
    },

    getDiffLink: function(reva, revb) {
      return this._diffLinkTemplate({
        github_href: this.get('github_href'),
        reva: reva,
        revb: revb
      });
    }
  });

  var Region = Backbone.Model.extend({});

  var Deployment = Backbone.Model.extend({
    initialize: function() {
      _.bindAll(this, 'getTimeSince', 'getStatus', 'getFullStatus', 'getStatusClasses');
    },

    getTimeSince: function() {
      function unitsAgo(seconds, denominator, units) {
        var number = Math.round(seconds / denominator);

        if (number === 1) {
          return number + ' ' + units + ' ago';
        } else {
          return number + ' ' + units + 's ago';
        }
      }

      var seconds = (Date.now() - this.get('time')) / 1000;

      if (seconds < 90) {
        // Up to 90 seconds ago
        return 'just now';
      } else if (seconds < 60 * 60) {
        // Up to 1 hour ago
        return unitsAgo(seconds, 60, 'minute');
      } else if (seconds < 60 * 60 * 24) {
        // Up to 1 day ago
        return unitsAgo(seconds, 60 * 60, 'hour');
      } else {
        return unitsAgo(seconds, 60 * 60 * 24, 'day');
      }
    },

    getStatus: function() {
      if (!this.get('finished')) {
        return 'in progress';
      } else if (this.get('success')) {
        return 'success';
      } else {
        return 'failed';
      }
    },

    // A status that includes the number
    getFullStatus: function() {
      var prefix = 'deployment #' + this.get('name');
      if (!this.get('finished')) {
        return prefix + ' in progress';
      } else if (this.get('success')) {
        return prefix + ' succeeded';
      } else {
        return prefix + ' failed';
      }
    },

    getStatusClasses: function() {
      var classes = [];
      if (this.get('finished')) {
        if (this.get('success')) {
          classes.push('success');
        } else {
          classes.push('important');
        }
      }

      return classes;
    }
  });

  var DreadnotView = Backbone.View.extend({
    el: 'body',

    initialize: function() {
      var self = this;

      _.bindAll(this, 'render');
      this.contentView = null;
      this.dreadnot = null;

      backend.getDreadnot(function(err, dreadnot) {
        self.dreadnot = dreadnot;
        self.render();
        self.router = new (Backbone.Router.extend({
          routes: {
            '': 'overview',
            'stacks/:stackName/regions/:regionName': 'regionOverview',
            'stacks/:stackName/regions/:regionName/deployments/:deploymentName': 'deploymentOverview'
          },

          overview: function() {
            self.setContent(new DreadnotOverview(self.dreadnot));
          },

          regionOverview: function(stackName, regionName) {
            self.setContent(new RegionOverview(self.dreadnot, stackName, regionName));
          },

          deploymentOverview: function(stackName, regionName, deploymentName) {
            self.setContent(new DeploymentOverview(self.dreadnot, stackName, regionName, deploymentName));
          }
        }))();
        Backbone.history.start();
      });

      this.render();
    },

    template: _.template(
      '<div class="topbar">' +
        '<div class="fill">' + 
          '<div class="container">' +
            '<a href="/#" class="brand"><%= title %></a>' +
            '<ul>' +
              '<li><a href="/#">Deploy</a></li>' +
              '<li><a href="/#warning">Warning Message</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="container"><div class="content"></div></div>'
    ),

    render: function() {
      var $content;

      if (this.dreadnot) {
        $(this.el).html(this.template({
          title: this.dreadnot.get('title')
        }));

        if (this.contentView) {
          $('.content').replaceWith(this.contentView.render().el);
        }
      } else {
        $(this.el).html('<h1>Loading...</h1>');
      }

      return this;
    },

    setContent: function(view) {
      this.contentView = view;
      $('.content').replaceWith(this.contentView.render().el);
    }
  });

  var DreadnotOverview = Backbone.View.extend({
    tagName: 'div',

    className: 'content',

    initialize: function(dreadnot) {
      var self = this;

      _.bindAll(this, 'render');
      this.dreadnot = dreadnot;

      backend.getStacks(function(err, stacks) {
        self.stacks = stacks;
        self.render();
      });
    },

    template: _.template(
      '<div class="page-header">' +
        '<h1><%= title %></h1>' +
      '</div>'
    ),

    render: function() {
      var self = this;

      $(this.el).html(this.template({
        title: this.dreadnot.get('name')
      }));

      if (this.stacks) {
        this.stacks.forEach(function(stack) {
          var overview = new StackOverview(stack);
          $(self.el).append(overview.render().el);
        });
      } else {
        $(this.el).append('<h2>Loading....</h2>');
      }

      return this;
    }
  });

  var RegionOverview = Backbone.View.extend({
    tagName: 'div',

    className: 'content',

    initialize: function(dreadnot, stackName, regionName) {
      var self = this;

      _.bindAll(this, 'render');
      this.dreadnot = dreadnot;
      this.stackName = stackName;
      this.regionName = regionName;
      this.stack = null;
      this.region = null;
      this.deployments = null;

      backend.getStack(stackName, function(err, stack) {
        self.stack = stack;
        self.render();
      });

      backend.getRegion(stackName, regionName, function(err, region) {
        self.err = err;
        self.region = region;
        self.render();
      });

      backend.getDeployments(stackName, regionName, function(err, deployments) {
        self.err = self.err || err;
        self.deployments = deployments;
        self.render();
      });
    },

    template: _.template(
      '<div class="page-header">' +
        '<h1><%= stackName %>:<%= regionName %></h1>' +
        '<a href="#">&larr; back to <%= envName %></a>' +
      '</div>'
    ),

    table: _.template(
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th>#</th>' +
            '<th>Time</th>' +
            '<th>User</th>' +
            '<th>Revisions</th>' +
            '<th>Result</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody></tbody>' +
      '<table>'
    ),

    render: function() {
      var self = this;

      $(this.el).html(this.template({
        envName: this.dreadnot.get('name'),
        stackName: this.stackName,
        regionName: this.regionName
      }));

      if (this.err) {
        $(this.el).append('<div class="alert-message error"><p>' + this.err.message + '</p></div>');
      } else if (this.region) {
        if (this.stack && this.deployments) {
          // Have deployments
          if (this.deployments.length === 0) {
            // But there aren't any
            $(this.el).append('<p>No Deployments</p>');
          } else {
            // And there are some
            $(this.el).append(this.table());
            this.deployments.forEach(function(deployment) {
              $('tbody', self.el).append(new DeploymentRowView(self.stack, self.region, deployment).render().el);
            });
          }
        } else {
          // Don't have deployments yet
          $(this.el).append('<h3>Loading Deployments...</h3>');
        }
      } else {
        // Don't have anything yet
        $(this.el).append('<h2>Loading Region....</h2>');
      }

      return this;
    }
  });

  var DeploymentOverview = Backbone.View.extend({
    tagName: 'div',

    className: 'content',

    initialize: function(dreadnot, stackName, regionName, deploymentName) {
      var self = this;

      _.bindAll(this, 'render');
      this.dreadnot = dreadnot;
      this.stackName = stackName;
      this.regionName = regionName;
      this.deploymentName = deploymentName;
      this.stack = null;
      this.region = null;
      this.deployment = null;

      backend.getStack(stackName, function(err, stack) {
        self.stack = stack;
        self.render();
      });

      backend.getRegion(stackName, regionName, function(err, region) {
        self.err = err;
        self.region = region;
        self.render();
      });

      backend.getDeployment(stackName, regionName, deploymentName, function(err, deployment) {
        self.err = self.err || err;
        self.deployment = deployment;
        self.render();
      });
    },

    template: _.template(
      '<div class="page-header">' +
        '<h1>Deployment #<%= deploymentName %> of <%= stackName %>:<%= regionName %></h1>' +
        '<a href="#stacks/<%= stackName %>/regions/<%= regionName %>">&larr; back to <%= regionName %></a>' +
      '</div>'
    ),

    commits: _.template(
      '<%= from_link %> &rarr; <%= to_link %> <%= diff_link %>'
    ),

    render: function() {
      var self = this;

      $(this.el).html(this.template({
        envName: this.dreadnot.get('name'),
        stackName: this.stackName,
        regionName: this.regionName,
        deploymentName: this.deploymentName
      }));

      if (this.err) {
        $(this.el).append('<div class="alert-message error"><p>' + this.err.message + '</p></div>');
      } else if (this.region && this.stack && this.deployment) {
        $(this.el).append('<p>' + new Date(this.deployment.get('time')).toUTCString() + ' by ' + this.deployment.get('user') + '</p>');
        $(this.el).append('<p>' + this.commits({
          from_link: this.stack.getCommitLink(this.deployment.get('from_revision')),
          to_link: this.stack.getCommitLink(this.deployment.get('to_revision')),
          diff_link: this.stack.getDiffLink(this.deployment.get('from_revision'), this.deployment.get('to_revision')),
        }) + '</p>');
        $(this.el).append('<pre class="deployment_log" />');
      } else {
        // Don't have anything yet
        $(this.el).append('<h2>Loading Deployment....</h2>');
      }

      return this;
    }
  });

  var LogView = Backbone.View.extend({

  });

  var DeploymentRowView = Backbone.View.extend({
    tagName: 'tr',

    initialize: function(stack, region, deployment) {
      _.bindAll(this, 'render');
      this.stack = stack;
      this.region = region;
      this.deployment = deployment;
      this.render();
    },

    template: _.template(
      '<td><a href="<%= deployment_href %>"><%= deployment_name %></td>' +
      '<td><%= time_since %></td>' +
      '<td><%= user %></td>' + 
      '<td><%= from_link %> &rarr; <%= to_link %> <%= diff_link %></td>' +
      '<td>' +
        '<% if (status) { %>' +
          '<span id="status" class="label">' +
            '<%= status %>' +
          '</span>' +
        '<% } %>' +
      '</td>'
    ),

    render: function() {
      var self = this,
          deployment_href = '#' + [
            'stacks',
            this.stack.get('name'),
            'regions',
            this.region.get('name'),
            'deployments',
            this.deployment.get('name')
          ].join('/');

      $(this.el).html(this.template({
        deployment_name: this.deployment.get('name'),
        deployment_href: deployment_href,
        time_since: this.deployment.getTimeSince(),
        user: this.deployment.get('user'),
        from_link: this.stack.getCommitLink(this.deployment.get('from_revision')),
        to_link: this.stack.getCommitLink(this.deployment.get('to_revision')),
        diff_link: this.stack.getDiffLink(this.deployment.get('from_revision'), this.deployment.get('to_revision')),
        status: this.deployment.getStatus()
      }));

      this.deployment.getStatusClasses().forEach(function(className) {
        $('#status', self.el).addClass(className);
      });

      return this;
    }
  });

  var StackOverview = Backbone.View.extend({
    tagName: 'div',

    initialize: function(stack) {
      var self = this;

      _.bindAll(this, 'render');
      this.stack = stack;
      this.regions = null;
      backend.getRegions(this.stack.get('name'), function(err, regions) {
        self.regions = regions;
        self.render();
      });
    },

    template: _.template(
      '<h2><% print(stack.get("name")); %></h2>' +
      '<p>Latest Revision: <% print(stack.getCommitLink(stack.get("latest_revision"))); %></p>' +
      '<table class="stack-region-list">' +
        '<thead>' +
          '<tr>' +
            '<th>Region</th>' +
            '<th>Deployed Revision</th>' +
            '<th>Last Deployed</th>' +
            '<th>Status</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody></tbody>' +
      '</table>'
    ),

    render: function() {
      var self = this;

      $(this.el).html(this.template({
        stack: this.stack
      }));

      if (this.regions) {
        this.regions.forEach(function(region) {
          var rowview = new RegionRowView(self.stack, region);
          $('tbody', self.el).append(rowview.render().el);
        });
      } else {
        $('table', this.el).replaceWith('<h3>Loading...</h3>');
      }

      return this;
    }
  });

  var RegionRowView = Backbone.View.extend({
    tagName: 'tr',

    initialize: function(stack, region) {
      var self = this;

      _.bindAll(this, 'render');
      this.stack = stack;
      this.region = region;
      this.deployment = null;
      backend.getDeployment(this.stack.get('name'), this.region.get('name'), this.region.get('latest_deployment'), function(err, deployment) {
        self.deployment = deployment;
        self.render();
      });
      this.region.bind('change', this.render);
      this.render();
    },

    template: _.template(
      '<td><a href="<%= region_href %>"><%= region_name %></td>' +
      '<td><% if (rev_link) { %><%= rev_link %> <%= diff_link %><% } %></td>' +
      '<td><%= last_deployed %></td>' +
      '<td>' + 
        '<% if (status) { %>' +
          '<a id="status" class="label" href="<%= latest_href %>">' +
            '<%= status %>' +
          '</a>' +
        '<% } %>' +
      '</td>'
    ),

    render: function() {
      var self = this,
          status = this.deployment ? this.deployment.getFullStatus() : false,
          region_href = '#' + [
            'stacks',
            this.stack.get('name'),
            'regions',
            this.region.get('name')
          ].join('/'),
          diffLink;

      if (this.deployment) {
        diffLink = this.stack.getDiffLink(this.deployment.get('to_revision'), this.stack.get('latest_revision'));
      }
      
      $(this.el).html(this.template({
        stack_name: this.stack.get('name'),
        region_name: this.region.get('name'),
        region_href: region_href,
        rev_link: this.deployment ? this.stack.getCommitLink(this.deployment.get('to_revision')) : undefined,
        diff_link: diffLink,
        last_deployed: this.deployment ? this.deployment.getTimeSince() : '',
        latest_href: !this.deployment ? null : [
          region_href,
          'deployments',
          this.deployment.get('name')
        ].join('/'),
        status: status
      }));

      if (this.deployment) {
        this.deployment.getStatusClasses().forEach(function(className) {
          $('#status', self.el).addClass(className);
        });
      }
      
      return this;
    }
  });

  new DreadnotView();

})(jQuery);
