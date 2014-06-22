function Metaify(obj) {
  var Meta = function () {};

  Meta.prototype.chain = function (chain_func) {
    var owner = false;
    if (!this.owner) {
      owner = {
        context: this,
        timer: null,
        stack: []
      } 
		} else {
      owner = this.owner;
		}

    var wrappedContext = function (func, owner) {
      this.func = func;
      this.owner = owner;

    };
    wrappedContext.prototype = owner.context.constructor.prototype;
    wrappedContext.prototype.constructor = wrappedContext;

    var env = new wrappedContext(chain_func, owner);
    env.owner.timer = setTimeout(function () {
      env.tick();
    }, 1);
    env.owner.stack.push(env);

    return env;
  };

  Meta.prototype.tick = function () {
    var self = this;
    if (!self.owner)
      return self;

    if (self.owner.timer)
      clearTimeout(this.owner.timer);

    if (self.owner.stack.length >= 1) {
      var chain_tip = self.owner.stack.shift();
      var ctx = this;
      ctx.next = function () {
        self.tick.call(self);
      }
      chain_tip.func.call(ctx);
    }
    return this;

  };

  Meta.prototype.haltChain = function () {
    if (this.owner && this.owner.timer)
      clearTimeout(this.owner.timer);
    if (this.owner && this.owner.stack)
      this.owner.stack = [];
    return this;
  }

  Meta.prototype.wrapChain = function () {
    if (this.owner && this.owner.timer)
      clearTimeout(this.owner.timer);
    return this;
  };

  Meta.prototype.getChain = function () {
    if (this.owner && this.owner.stack)
      return this.owner.stack;
    return [];
  };

  for (var prop in Meta.prototype)
    obj.prototype[prop] = Meta.prototype[prop];
  return obj;
}