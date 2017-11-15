const through2 = require("through2");
const uuid = require("uuid/v1");
const miss = require("mississippi");

const ResumeThrough = require("./lib/resume-through");


function resumethrough(options, ...transforms) {
    if (!options && transforms.length == 0) {
        // no args passed
        return wrap({});
    } else if (typeof options === 'function') {
        // no options were passed, options is the first transform stream
        transforms.unshift(options);
        return wrap({})(...transforms);
    } else if (typeof options === 'object') {
        // options were passed, and maybe transforms, we don't care here
        return wrap(options, ...transforms);
    }
}

const defaults = {
    identifier: uuid
}

function wrap(options, ...transforms) {

    options = Object.assign(defaults, options);

    if (transforms.length == 0) {
        // only options were passed, no transforms
        // return a reusable function that will wrap either a pipeline or a single transform
        return function (name, ...transforms) {
            if (typeof name === 'function') {
                transforms.unshift(name);
                name = undefined;
            }
            if (transforms.length == 1) {
                return wrapTransform(name, transforms[0]);
            } else if (transforms.length > 1) {
                return wrapPipeline(name, ...transforms);
            }
        }
    } else {
        // if transforms are passed up front, passed the wrapped transform or pipeline up front
        if (transforms.length == 1) {
            return wrapTransform(name, transforms[0]);
        } else if (transforms.length > 1) {
            return wrapPipeline(name, ...transforms);
        }
    }

    function wrapPipeline(name, ...transforms) {
        return miss.pipeline(transforms.map(wrapTransform));
    }
    
    function wrapTransform(name, transform) {
        const wrapper = function (chunk, enc, cb) {
            if (!chunk.__resume_through) {
                chunk.__resume_through = new ResumeThrough(options, chunk);
            }
            let ticket = chunk.__resume_through;
            ticket.history.push(name);
            transform(chunk, enc, cb);
        }
    
        return through2.obj(wrapper);
    }
}

module.exports = resumethrough;