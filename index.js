var _ = require('underscore')

// converts retarded magical arguments object to Array object
function toArray(arg) { return Array.prototype.slice.call(arg) }

// call callback if its defined.. I wrap all my callback calls in this to make callbacks optional
var cb = exports.cb = function() {
    var args = toArray(arguments);
    var f = args.shift()
    if (!f) { return }
    f.apply(this,args)
}

// decorates a function
var decorate = exports.decorate = function (decorator, f) {
    return function() {
        var args = toArray(arguments)
        args.unshift(f)
        return decorator.apply(this,args)
    }
}

// converts a function that accepts single argument to a function that can accept an array and be called multiple times for each element
exports.multiArg = function() {
    var args = toArray(arguments);
    return _.map(args,args.shift());
}

// reverses arguments 
exports.reverseArg = function() {
    var args = toArray(arguments);
    var f = args.shift()
    f.apply(this,args.reverse())
}


exports.MakeDecorator_bindargs = function() {
    var bindargs = toArray(arguments);

    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        f.apply(this,bindargs.concat(args))
    }
}


var bindargs = exports.bindargs = 
    function(f,args) { return decorate(exports.MakeDecorator_bindargs(args),f) }



// creates decorator which will delay the execution
exports.MakeDecorator_delay = function(delay) {
    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        setTimeout(function() { f.apply(this,args) },delay)
    }
}

// automatically retries the function execution if it fails..
exports.MakeDecorator_retry = function(options) {
    if (!options) { options = {} }

    options = _.extend({
        delay: 1000,
        retries: 4,
        fail: undefined, // special callback for failiures
        failcall: false // call callback on each execution, not only on success?
        
    }, options)

    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        var callback = args.pop()
        
        var cb = function(err,data) {
            if ((!err) || (options.retries == 0 )) { callback(err,data); return }
            if (options.failcall) { callback(err,data) }

            cb(fail,err,data)

            setTimeout(call,options.delay)
            options.delay += options.delay
            options.retries -= 1
        }

        var call = bindargs(f,cb)

        call()
    }
}


exports.retry = exports.MakeDecorator_retry()