(function (root, undefined) {
  _bind = function (func, context) {
    return function () {
      return func.apply(context, arguments);
    };
  };
  _slice = [].slice;

  // Developer defined event handlers
  var _handlers = [];
  var _callstack = [];

  var eventSpliter = /^(\S+)\s*(.*)$/;

  // Enable/Disable debugging
  var _debug = false,
    _host = 'getwire.io',
    _port = 8080,
    _endpoint, _auth = '/wio-authorize',
    _public_key, _identity;

  var _events = {
    fire: 'wio.command/fire',
    trap: 'wio.command/trap',
    identity: 'wio.command/identity',
    connected: 'wio.connected',
    disconnected: 'wio.disconnected'
  };

  var debug = function (msg) {
    var args;

    args = 1 <= arguments.length ? _slice.call(arguments, 0) : [];
    if (_debug) {
      return console.log.apply(console, args);
    }
  };

  /**
   * Gateway: The internal connection manager with WireIO
   * Handles the following:
   * 1) Connection strategy
   * 2) Connection state
   * 3) Reconnection strategy
   * 4) Core connection events
   */
  var Gateway = {
    state: {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    },

    // Supported transports
    // Currently WireIO only supports Websockets
    transports: {
      ws: function () {
        var socket = false;
        if (root.WebSocket)
          socket = root.WebSocket;
        if (root.MozWebSocket && navigator.userAgent.indexOf("Firefox/6.0") == -1)
          socket = root.MozWebSocket;
        if (socket)
          return {
            heart: true,
            socket: socket,
            protocol: "ws://",
            secure: false
          };

        return false;
      }
    },

    // The currently connected transport index
    transportId: 0,
    connected: false,
    send: function () {},
    /**
     * Responsible for selecting a suitable transport
     * The current implementation is naive, it will simply iterate over all the transports and attempts to establish a connection,
     * moving to the next transport if the transport initialization fails. For instance, websockets not being supported.
     */
    selectTransport: function () {
      var count = 0;

      for (var transport in Gateway.transports) {
        if (Gateway.transportId == count) {
          var a_transport = Gateway.transports[transport]();
          if (a_transport) {
            var selected_transport = new a_transport.socket(a_transport.protocol + _endpoint);
            selected_transport.heart = a_transport.heart;
            return selected_transport;
          }
          Gateway.transportId++;
        }

        count++;

      }
      return false;
    },

    /**
     * Access point to the Gateway module, initializing the Gateway module happens through the Wire class
     * It will manage the connection, reconnecting and notifications of network events
     */
    Wire: function () {
      var ready_state = Gateway.state.CLOSED,
        heart_beat, grace_period = 100,
        max_grace_period = 2 * 60000 // 2 minutes
        ,
        trial_index = 0,
        max_trials = 5,
        selected_transport;
      var self = this;

      var pre_init = function () {
        // Setup the identity handler, so we can identify the connection with a unique ID
        addCallback(_events.identity, function (identity) {
          WireIOKlass.prototype.identity = _identity = identity.data;
					self.trigger(_events.connected, identity.data);
          debug("<<Setting identity>>");
        });
        debug("<<Registered callback for identity>>");
      }

      var init = function () {
        ready_state = Gateway.state.CONNECTING;
        selected_transport = Gateway.selectTransport();

        selected_transport.onopen = function () {
          Gateway.connected = true;

          if (selected_transport.heart)
            heart_beat = setInterval(function () {
              self.onHeartbeat();
            }, 20000);

          if (ready_state != Gateway.state.OPEN) {
            ready_state = Gateway.state.OPEN;
            Gateway.send = function (m) {
              return selected_transport.send.call(selected_transport, m);
            };
            while (_callstack.length > 0)
              (_callstack.shift())();
          }
          debug("<<Connection established>>");
        };
        selected_transport.onclose = function (close_event) {
          if (closed)
            return;
          clearInterval(heart_beat);
          if (ready_state == Gateway.state.CLOSING) {
            ready_state = Gateway.state.CLOSED;
          } else {
            if (ready_state == Gateway.state.CONNECTING)
              Gateway.transportId++;

            Gateway.connected = false;

            if (!(grace_period > max_grace_period) && !(trial_index > max_trials)) {
              grace_period = grace_period * max_trials;
              setTimeout(function () {
                init();
              }, grace_period);
            }

          }
          self.trigger(_events.disconnected, close_event.code);
          debug("<<Connection dropped>>::<<Code>>==> " + close_event.code);
        };
        selected_transport.onerror = selected_transport.onclose;

        selected_transport.onmessage = function (m) {
          var parsed_data = JSON.parse(m.data);
          self.trigger(parsed_data.event, parsed_data.payload);
          debug("<<Payload Arrived>>::<<Event>>==> " + parsed_data.event);
        };

      };
      pre_init();
      init();
    }

  };

  Gateway.Wire.prototype.onHeartbeat = function () {};
  Gateway.Wire.prototype.trigger = function () {
    var args, event, callbacks, i, len;
    event = arguments[0], args = 2 <= arguments.length ? _slice.call(arguments, 1) : [];
    callbacks = _handlers[event];
    if (!callbacks)
      return;
    for (i = 0, len = callbacks.length; i < len; i++)
      callbacks[i].apply(null, args);
  };

  var send = function (data) {
    var json_data = JSON.stringify(data);
    if (!Gateway.send(json_data))
      throw new Error("Firing the following event failed: " + json_data);
  };

  var wrapperFunc = function (fn, context, args) {
    return function () {
      fn.call(context, args);
    };
  };

  var addCallback = function (e, callback) {
    if (!_handlers[e])
      _handlers[e] = [];
    _handlers[e].push(callback);
  };

  var queue = function (data) {
    if (Gateway.connected)
      send(data);
    else
      _callstack.push(wrapperFunc(send, this, data));
  };

  var WireIO = {
    init: function (options) {
      if (!options.public_key)
        throw new Error("Invalid public key: A public key must be provided");

      _debug = options.debug || _debug;
      _host = options.host || _host;
      _port = options.port || _port;
      _auth = options.auth || _auth;
      _public_key = options.public_key;

      _endpoint = _host + ":" + _port + "/app/" + _public_key;

      return new WireIOKlass();
    }

  };
	WireIO.$ = WireIO.jQuery = jQuery.noConflict(true);

  var WireIOKlass = function (endpoint) {
    var gateway = new Gateway.Wire();
  };

  WireIOKlass.prototype.when = function (el_event) {
    this.wrapChain().chain(function () {
      var match = el_event.match(eventSpliter);
      return [match[1], match[2]];
    });
  };

  WireIOKlass.prototype.fire = function (e, data) {
    var self = this;
    return this.wrapChain().chain(function () {
      if (this.getChain().length == 1) {
        var el_event = this.getChain()[0].func();
        WireIO.$(el_event[0]).bind(el_event[1], function (ui_event) {
          queue({
            event: _events.fire,
            payload: {
              e: e,
              data: data
            }
          });
        });
      } else {
        queue({
          event: _events.fire,
          payload: {
            e: e,
            data: data
          }
        });
      }
      this.next();
    });
  };

  WireIOKlass.prototype.on = function (e, callback) {
    addCallback(e, callback);
    queue({
      event: _events.trap,
      payload: {
        e: e
      }
    });
  };

  Metaify(WireIOKlass);
  root.WireIO = WireIO;
}(window));