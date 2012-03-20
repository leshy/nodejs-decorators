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


/*
// accepts multiple functions, and returns one that will call all of them when called
var joinfun = exports.joinfun = function() {
    var functions = toArray(arguments)
    return function() {
        var args = toArray(arguments);
        _.map(functions, function(f) {
            f.call(this,args)
        })
    }
}
*/

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
/*
// accepts callbacks that will be called in parallel with that a functions normal callback
exports.MakeDecorator_bindcallback = function() {
    var callbacks = toArray(arguments);
    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        if (_.last(args).constructor == Function ) {
            callbacks = joinfun(callbacks.concat(args.pop()))
        }
        f.apply(this,args.concat(callbacks))
    }
}

var bindcallback = exports.bindcallback = function() {
    var args = toArray(arguments);
    var f = args.shift()
    return decorate(exports.MakeDecorator_bindcallback(args),f)
}
*/

// will put sticky arguments to a function
exports.MakeDecorator_bindargs = function() {
    var bindargs = toArray(arguments);
    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        f.apply(this,bindargs.concat(args))
    }
}

var bindargs = exports.bindargs = 
    function() { 
        var args = toArray(arguments)
        var f = args.shift()
        return decorate(exports.MakeDecorator_bindargs.apply(this,args),f)
    }


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
        retries: 3,
        fail: undefined, // special callback for failiures
        failcall: false // call callback on each execution, not only on success?
        
    }, options)

    return function() {
        var args = toArray(arguments);
        var f = _.first(args)

        var callback = args.pop()
        
        var checkcallback = function(err,data) {
            if ((!err) || (options.retries == 0 )) { callback(err,data); return }
            if (options.failcall) { console.log('err!',err); callback(err,data) }

            if (options.fail) { options.fail(err,data)}

            setTimeout(call,options.delay)
            options.delay += options.delay
            options.retries -= 1
        }
        
        args.push(checkcallback)
        var call = bindargs.apply(this,args)
        call()
    }
}


exports.retry = exports.MakeDecorator_retry()




// function decorated with this will have a 'cooldown' periond to avoid executing itself too frequently (defined by buffertime),
exports.MakeDecorator_BurstLimit = function(buffertime) {
    var data = { timeout: undefined, last: 0 }
    return function() {
        var self = this;
        var now = new Date().getTime();
        var args = toArray(arguments), f = args.shift();
        
        function runf() { 
            data.last = new Date().getTime();
            f.apply(self,args) 
        }

        var timediff = now - data.last

        if ((timediff) > buffertime) {
            runf(); return
        }

        // remove last 
        if (data.timeout) { clearTimeout(data.timeout); data.timeout = undefined }
        data.timeout = setTimeout ( runf, timediff)
    }
}

// won't execute itself right away to see if aditional calls to it are received.
// all the aditional calls will be supressed until the buffertime passes and the function gets executed
//
//  var render = decorate(MakeDecorator_BurstLimit2(500), function() {  ... })
//
exports.MakeDecorator_BurstLimit2 = function(buffertime) {
    var data = { timeout: undefined, last: 0 }
    return function() {
        var self = this;
        var now = new Date().getTime();
        var args = toArray(arguments), f = args.shift();
        
        function runf() { 
            data.timeout = undefined
            data.last = new Date().getTime();
            f.apply(self,args) 
        }

        if (!data.timeout) {
            data.timeout = setTimeout ( runf, buffertime)
        }            

    }
}
