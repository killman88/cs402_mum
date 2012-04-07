HOST = null; // localhost
PORT = 8001;

  //does the argument only contain whitespace?
  function isBlank(text) {
    var blank = /^\s*$/;
    return (text.match(blank) !== null);
  }

// when the daemon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
// every 10 seconds poll for the memory.
setInterval(function () {
  mem = process.memoryUsage();
}, 10*1000);


var fu = require("./js/fu"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring");

var MESSAGE_BACKLOG = 200,
    SESSION_TIMEOUT = 60 * 1000;

var channel = new function () {
  var messages = [],
      callbacks = [];

  this.appendMessage = function (nick, type, text) {
    var m = { nick: nick
            , type: type // "msg", "join", "part"
            , text: text
            , timestamp: (new Date()).getTime()
            };

    switch (type) {
      case "char":
        //sys.puts("updating last message by " + nick + " to " + text);
        break;
      case "msg":
        sys.puts("<" + nick + "> " + text);
        break;
      case "join":
        sys.puts(nick + " join");
        break;
      case "part":
        sys.puts(nick + " part");
        break;
    }

    if (type !== "char")
      messages.push( m );
    else {
      //if (type === "char") {

      for (i = messages.length - 1; i >= 0; i--) {
        if (messages[i].nick === m.nick) {
          messages[i] = m;
          break;
        }
        messages.push( m );
      }
        
    }

    while (callbacks.length > 0) {
      callbacks.shift().callback([m]);
    }

    while (messages.length > MESSAGE_BACKLOG)
      messages.shift();
  };

  this.query = function (since, callback) {
    var matching = [];
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      if (message.timestamp > since)
        matching.push(message)
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  // clear old callbacks
  // they can hang around for at most 30 seconds.
  setInterval(function () {
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 30*1000) {
      callbacks.shift().callback([]);
    }
  }, 3000);
};

var sessions = {};

function createSession (nick) {
  if (nick.length > 50) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;

  for (var i in sessions) {
    var session = sessions[i];
    if (session && session.nick === nick) return null;
  }

  var session = { 
    nick: nick, 
    id: Math.floor(Math.random()*99999999999).toString(),
    timestamp: new Date(),

    poke: function () {
      session.timestamp = new Date();
    },

    destroy: function () {
      channel.appendMessage(session.nick, "part");
      delete sessions[session.id];
    }
  };

  sessions[session.id] = session;
  return session;
}

// interval to kill off old sessions
setInterval(function () {
  var now = new Date();
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];

    if (now - session.timestamp > SESSION_TIMEOUT) {
      session.destroy();
    }
  }
}, 1000);


fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("login.html"));
fu.get("/css/styles.css", fu.staticHandler("css/styles.css"));
// css file for auth page
fu.get("/css/styles-auth.css", fu.staticHandler("css/styles-auth.css"));
fu.get("/css/bootstrap.css", fu.staticHandler("css/bootstrap.css"));
fu.get("/css/bootstrap-responsive.css", fu.staticHandler("css/bootstrap-responsive.css"));
fu.get("/js/client.js", fu.staticHandler("js/client.js"));
// javascript file for auth queries
fu.get("/js/connect-auth.js", fu.staticHandler("js/connect-auth.js"));
fu.get("/js/jquery.js", fu.staticHandler("js/jquery.js"));
fu.get("/js/prettify.js", fu.staticHandler("js/prettify.js"));
fu.get("/js/bootstrap-dropdown.js", fu.staticHandler("js/bootstrap-dropdown.js"));
fu.get("/js/bootstrap-modal.js", fu.staticHandler("js/bootstrap-modal.js"));
fu.get("/js/bootstrap-transition.js", fu.staticHandler("js/bootstrap-transition.js"));

fu.get("/js/tiny_mce/themes/simple/skins/default/ui.css", fu.staticHandler("js/tiny_mce/themes/simple/skins/default/ui.css"));
fu.get("/js/tiny_mce/themes/simple/skins/default/content.css", fu.staticHandler("js/tiny_mce/themes/simple/skins/default/content.css"));
fu.get("/js/tiny_mce/themes/simple/img/icons.gif", fu.staticHandler("js/tiny_mce/themes/simple/img/icons.gif"));
fu.get("/js/tiny_mce/jquery.tinymce.js", fu.staticHandler("js/tiny_mce/jquery.tinymce.js"));
fu.get("/js/tiny_mce/tiny_mce.js", fu.staticHandler("js/tiny_mce/tiny_mce.js"));
fu.get("/js/tiny_mce/themes/simple/langs/en.js", fu.staticHandler("js/tiny_mce/themes/simple/langs/en.js"));
fu.get("/js/tiny_mce/langs/en.js", fu.staticHandler("js/tiny_mce/langs/en.js"));
fu.get("/js/tiny_mce/themes/simple/editor_template.js", fu.staticHandler("js/tiny_mce/themes/simple/editor_template.js"));


fu.get("/img/glyphicons-halflings.png", fu.staticHandler("img/glyphicons-halflings.png"));
fu.get("/img/glyphicons-halflings-white.png", fu.staticHandler("img/glyphicons-halflings-white.png"));

fu.get("/who", function (req, res) {
  var nicks = [];
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }
  res.simpleJSON(200, { nicks: nicks
                      , rss: mem.rss
                      });
});

fu.get("/join", function (req, res) {
  var nick = qs.parse(url.parse(req.url).query).nick;
  if (nick == null || nick.length == 0) {
    res.simpleJSON(400, {error: "Bad nick."});
    return;
  }
  var session = createSession(nick);
  if (session == null) {
    res.simpleJSON(400, {error: "Nick in use"});
    return;
  }

  //sys.puts("connection: " + nick + "@" + res.connection.remoteAddress);

  channel.appendMessage(session.nick, "join");
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      , rss: mem.rss
                      , starttime: starttime
                      });
});

fu.get("/part", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function (req, res) {
  if (!qs.parse(url.parse(req.url).query).since) {
    res.simpleJSON(400, { error: "Must supply since parameter" });
    return;
  }
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.poke();
  }

  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  channel.query(since, function (messages) {
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
});

fu.get("/send", function (req, res) {
  var id   = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;
  var eom  = qs.parse(url.parse(req.url).query).endOfMessage;

  var session = sessions[id];
  if (!session || !text) {
    res.simpleJSON(400, { error: "No such session id" });
    return;
  }

  session.poke();

  if (eom === "true") {
    channel.appendMessage(session.nick, "msg", text);
  } else {
    channel.appendMessage(session.nick, "char", text);
  }
  
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/mail", function (req, res) {
    var sender   = qs.parse(url.parse(req.url).query).sender;
    var receiver = qs.parse(url.parse(req.url).query).receiver;
    var message  = qs.parse(url.parse(req.url).query).message;

    fu.mail({to: receiver, from: sender, msg: message});

    res.simpleJSON(200, {success: "It worked!"});

});
