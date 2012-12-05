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
        failcall: false, // call callback on each execution, not only on success?
        delaymodifier: function (x) { return x + x } // each retry can change the delay time
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
            options.delay = options.delaymodifier(options.delay)
            options.retries -= 1
        }
        
        args.push(checkcallback)
        var call = bindargs.apply(this,args)
        call()
    }
}


exports.retry = exports.MakeDecorator_retry()


// receive functions and return a function that when gets called calls all those functions with its arguments
//
function joinf() {
    var fs = toArray(arguments)
    return function() {
        var args = toArray(arguments)
        _.map(fs, function(f) { f.apply(this,args) })
    }
}


// accepts arguments array and a function, if arguments contain a callback, it joins it with a hook function, if not, it just appends a hook function
// to arguments
//
function HookCallback(args,hook) {
    if (_.last(args).constructor == Function) {
        var originalcb = args.pop()
        args.push(joinf(originalcb,hook))
    } else {
        args.push(hook)
    }
}


// this one allows only one instance of function with a particular argument group to be executing.
// super ugly implementation that's using JSON instead of copy, 
// should be abstracted to accept a comparison function for arguments

exports.MakeDecorator_OneArg = function() {
    
    var executing = {}

    return function() {
        var self = this;
        var args = toArray(arguments), f = args.shift();

        
        if (_.last(args) && _.last(args).constructor == Function) { callback = args.pop() }

        var execargs = JSON.stringify(args)
        
        if (executing[execargs]) {
            return
        }
        
        executing[execargs] = true

        args.push(function () {
            delete executing[execargs]
            if (callback) { callback.apply(this,arguments) }
        })

        f.apply(this,args)
    }
}



// some metadecorators that don't map every functioncall directly to a functioncall of a target function (eg throttling decorators)
// need a way to aggregate arguments from multiple calls to into one argument list,
//
// arghandler is an object that specifies an algo for this
// zipArgHandler is a default sample implementation
//
// if you call:
//
// bla(1,2)
// bla('a','b')
//
// after arghandler flush you'll get a call
//
// bla ([1,'a'],[2,'b'])
//

exports.zipArgHandler = function(arglength,checkcallback) {
    this.arglength = arglength
    this.checkcallback = checkcallback
    this.reset()
}

exports.zipArgHandler.prototype.reset = function() {
    var self = this;
    this.args = [];
    _.times(this.arglength, function(n) { self.args.push([]) })
}

exports.zipArgHandler.prototype.feed = function(array)  {
    _.map(this.args, function(bucket,bucketnum) { bucket.push(array[bucketnum]) })
}

exports.zipArgHandler.prototype.length = function() {
    return this.args[0].length
}

exports.zipArgHandler.prototype.flush = function() {
    var args = this.args
    this.reset()

    if (this.checkcallback) {
        // save some mem by filtering ones with clalbacks
        var x = args.pop()
        var callbacks = _.filter(x, function(arg) { return Boolean(arg) })
        if (callbacks.length) {
            args.push(function() {
                var args = toArray(arguments)
                _.map(callbacks, function(f) { if (f) { f.apply(this,args)} })
            })
        }
        
    }
    return args
}


exports.LastArgHandler = function() {
    this.args = []
}

exports.LastArgHandler.prototype.feed = function(args) {
    this.args = args
}

exports.LastArgHandler.prototype.flush = function() {
    return this.args
    this.args = []
}






// onebyone and throttle decorators should use the same code


//
// won't execute a target function until last execution of the target function is completed (expect a function to receive a callback)
// it can add an optional wait between first function returning and second being executed
//
// this decorator uses arghandlers (check above)
//
exports.MakeDecorator_OneByOne = function(options) {
    
    if (!options) { options = {} }
    
    data = _.extend({ active : false, 
                      cooldownTime: 30000, 
                      cooldownTimer: undefined 
                    },options)

    if (!data.arghandler) { data.arghandler = new exports.LastArgHandler() }

    return function() {
        var args = toArray(arguments), f = args.shift();

        data.arghandler.feed(args)

        function pump_it() {
            data.active = true
            
            if (data.cooldownTime) { data.cooldownTimer = setTimeout( function () { data.active = false; pump_it() }, data.cooldownTime ) }

            var call_args = data.arghandler.flush()
            HookCallback(call_args, function() {
                if (data.cooldownTimer) { clearTimeout(data.cooldownTimer); data.cooldownTimer = undefined }
                data.active = false
                if (data.arghandler.length()) {
                    setTimeout(pump_it,0)
                }
            })

            f.apply(this,call_args)
        }
        
        if (!data.active) {
            pump_it()
        } 
    }
}


//
// won't execute itself right away to see if aditional calls to it are received.
// all the aditional calls will be supressed until the buffertime passes and the function gets executed
//
// this decorator uses arghandlers (check above)
// 
//  var render = decorate(MakeDecorator_Throttle(500), function() {  ... })
//
exports.MakeDecorator_Throttle = function(options) {
    
    if (!options) { options = {} }
    var data = { t: undefined }
    
    data = _.extend(data,options)
    
    if (!data.arghandler) { data.arghandler = new exports.LastArgHandler() }
    if (!data.timeout) { data.timeout = 500 }

    return function() {
        var self = this;
        var now = new Date().getTime();
        var args = toArray(arguments), f = args.shift();

        if (data.arghandler) { data.arghandler.feed(args) }

        function runf() {
            data.t = undefined
            
            if (data.arghandler) { f.apply(self,data.arghandler.flush()) } 
            else {  f.apply(self,args) }
        }
        
        if (!data.t) {
            data.t = setTimeout ( runf, data.timeout)
        }
    }
}



// defines timeout for a function, if timeout is triggered before the function returns,
// callback will be called with an error object
exports.MakeDecorator_Timeout = function (options) { 

    if (!options) { options = {} }
    if (!options.timeout) { options.timeout = 1000 }

    return function () { 
        var args = toArray(arguments), f = args.shift();
        var callback
        if (args.length()) {
            if ((callback = args.pop()).constructor != Function) { throw "expected function as a callback, got something else" }
            
            var timeouted = false
            var timeout = setTimeout(function() { 
                timeouted = true
                callback({ timeout: true })
            }, options.timeout)

            args.push(function() { 
                if (timeouted) { return }
                callback.apply(this,arguments) 
            })
            
        } else { throw "expected function as a callback, got nothing" }

        f.apply(this,args)
    }
}



exports.MakeObjReceiver = function(objclass) {
    return function() {
        var args = toArray(arguments);
        var f = args.shift();
        if ((!args.length) || (!args[0])) { f.apply(this,[]); return }
        if (args[0].constructor != objclass) { args[0] = new objclass(args[0]) }
        return f.apply(this,args)
    }
}
