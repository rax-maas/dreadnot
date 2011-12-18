
# Connect FS

connect-fs is a FileSystem session store, just copied connect-redis.

 connect-fs support only connect `>= 1.4.0`.

## Installation

	  $ npm install connect-fs

## Options

  - `dir='./sessions'` Direcotry to save session files

## Usage

    var connect = require('connect')
	 	  , FSStore = require('connect-fs')(connect);

    connect.createServer(
      connect.cookieParser(),
      connect.session({ store: new FSStore, secret: 'your secret' })
    );

  with express    

    var FSStore = require('connect-fs')(express);

    app.configure(function() {
      app.set('views', __dirname + '/views');
      app.set('view engine', 'ejs');
      app.use(express.bodyParser());
      app.use(express.methodOverride());
      app.use(express.cookieParser());
      app.use(express.session({
        store: new FSStore,
        secret: 'your secret',
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
      }));
      app.use(app.router);
      app.use(express.static(__dirname + '/public'));
    });

