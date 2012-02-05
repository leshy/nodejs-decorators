// converts retarded magical arguments object to Array object
function toArray(arg) { return Array.prototype.slice.call(arg) }

// call callback if its defined.. I wrap all my callback calls in this to make callbacks optional
exports.cb = function() {
    var args = toArray(arguments);
    if (!args.length) { return }
    var f = args.shift()
    f.apply(this,args)
}


// decorates a function
exports.decorate = function (decorator, f) {
    return function() {
        var args = toArray(arguments)
        args.unshift(f)
        return decorator.apply(this,args)
    }
}

// converts a function that accepts single argument to a function that can accept an array and be called multiple times for each element
exports.decorator_multiArg = function() {
    var args = toArray(arguments);
    return _.map(args,args.shift());
}

// creates decorator which will delay the execution
exports.MakeDecorator_delay = function(delay) {
    return function() {
        var args = toArray(arguments);
        var f = args.shift()
        setTimeout(function() { f.apply(this,args) },delay)
    }
}

// reverses arguments 
exports.decorator_reverseArg = function() {
    var args = toArray(arguments);
    var f = args.shift()
    f.apply(this,args.reverse())
}


// automatically retries the function execution if it fails..
exports.decorator_retry = function() {
    var args = toArray(arguments);
    var f = args.shift()
    _.asy
    exports.make_decorator_delay(f,1000)
    
}