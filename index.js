var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function QPromise(fn) {
  // store state which can be PENDING, FULFILLED or REJECTED
  var state = PENDING;

  // store value once FULFILLED or REJECTED
  var value = null;

  // store sucess & failure handlers
  var handlers = [];

  function fulfill(result) {
    state = FULFILLED;
    value = result;
    handlers.forEach(handle); // 执行所有的 onFulfilled() passed in
    handlers = null;
  }

  function reject(error) {
    state = REJECTED;
    value = error;
    handlers.forEach(handle); // 执行所有的 onRejected()
    handlers = null;
  }

  function resolve(promise, result) {
    if (promise === result) { // 2.3.1
      reject(new TypeError("The resolved value cannot be the same Promise"));
    } 
    try {
      var then = getThen(result);
      if (then) {
        doResolve(then.bind(result), promise)
        return
      }
      fulfill(result);
    } catch (e) {
      reject(e);
    }
  }

  /**
  * Check if a value is a Promise and, if it is,
  * return the `then` method of that promise.
  */
  function getThen(value) {
    var t = typeof value;
    if (value && (t === 'object' || t === 'function')) {
      var then = value.then;
      if (typeof then === 'function') {
        return then;
      }
    }
    return null;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * @param {Function} fn A resolver function that may not be trusted
   * @param {Object} promise current promise
   */
  function doResolve(fn, promise) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return
        done = true
        resolve(promise, value)
      }, function (reason) {
        if (done) return
        done = true
        reject(reason)
      })
    } catch (ex) {
      if (done) return
      done = true
      reject(ex)
    }
  }

  // 如果状态是 pending 就完成之后（fulfilled或者rejected状态）再处理
  // 如果已经是 fulfilled or rejected 状态，直接调用
  function handle(handler) {
    // ensure we are always asynchronous
    setTimeout(function () {
      if (state === PENDING) {
        handlers.push(handler);
      } else {
        if (state === FULFILLED) {
          handler.onFulfilled(value);
        }
        if (state === REJECTED) {
          handler.onRejected(value);
        }
      }
    }, 0)
  }

  this.then = function(onFulfilledFn, onRejectedFn) {
    // then returns a new Promise
    return new QPromise(function (resolve, reject) {
      handle({
        onFulfilled: function (result) {
          if (typeof onFulfilledFn === 'function') {
            try {
              return resolve(onFulfilledFn(result), this);
            } catch (ex) {
              return reject(ex);
            }
          } else {
            return resolve(result, this);
          }
        },
        onRejected: function (error) {
          if (typeof onRejectedFn === 'function') {
            try {
              return resolve(onRejectedFn(error), this);
            } catch (ex) {
              return reject(ex);
            }
          } else {
            return reject(error);
          }
        }
      });
    });
  }

  doResolve(fn, this);
}


// export adapter for testing
module.exports = {
  resolved: function (value) {
      return new QPromise(function (resolve) {
          resolve(value);
      });
  },
  rejected: function (reason) {
      return new QPromise(function (resolve, reject) {
          reject(reason);
      });
  },
  deferred: function () {
      var resolve, reject;

      return {
          promise: new QPromise(function (rslv, rjct) {
              resolve = rslv;
              reject = rjct;
          }),
          resolve: resolve,
          reject: reject
      };
  }
};
