const through2 = require("through2");
const uuid = require("uuid/v1");
const miss = require("mississippi");

const ResumeThrough = require("./lib/resume-through");


function resumethrough(options, ...transforms) {
    if (!options && transforms.length == 0) {
        // no args passed
        return wrap({});
    } else if (typeof options === 'object' && options.constructor.name == 'Object') {
        // options were passed, and maybe transforms, we don't care here
        return wrap(options, ...transforms);
    } else if (typeof options === 'function' || typeof options === 'object') {
        // no options were passed, options is the first transform stream
        transforms.unshift(options);
        return wrap({})(...transforms);
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
        return function (...transforms) {
            if (transforms.length == 1) {
                if (typeof transforms[0] === 'function') {
                    return wrapTransform(transforms[0]);
                } else if (typeof transforms[0] === 'object') {
                    return wrapPipeline(transforms[0]);
                }
            } else if (transforms.length > 1) {
                return wrapPipeline(...transforms);
            }
        }
    } else {
        // if transforms are passed up front, passed the wrapped transform or pipeline up front
        if (transforms.length == 1) {
            return wrapTransform(transforms[0]);
        } else if (transforms.length > 1) {
            return wrapPipeline(...transforms);
        }
    }

    function wrapPipeline(...transforms) {
        if (transforms.length == 1) {
            var names = [];
            var values = [];
            for (let name in transforms[0]) {
                names.push(name);
                values.push(transforms[0][name]);
            }
            transforms = values;
        }
        
        let increment = 0;
        function nameMe() {
            if (names) {
                return names[increment++];
            } else {
                return 'transform' + increment++;
            }
        }

        const pipeline = miss.pipeline.obj(transforms.map(wrapTransform));

        (function startInspection(inspector) {
            return miss.from.obj(function (size, next) {
                let chunk = inspector;
                inspector = null;
                next(null, chunk);
            });
        })({__resume_through_inspector: true, nameMe: nameMe}).pipe(pipeline);

        return pipeline;
    }
    
    function wrapTransform(transform) {
        // if it's already wrapped, unwrap so we can rewrap
        if (typeof transform === 'object' && transform._transform)
            transform = transform._transform;

        const wrapper = function (chunk, enc, cb) {
            // watch for the pipeline inspector and use it to identify this transform
            if (chunk.__resume_through_inspector) {
                if (this.__resume_through_name == undefined) {
                    this.__resume_through_name = chunk.nameMe();
                }
                cb(null, chunk);
            } else {
                if (!chunk.__resume_through) {
                    chunk.__resume_through = new ResumeThrough(options, chunk);
                }
                chunk.__resume_through.history.push(this.__resume_through_name);
                transform(chunk, enc, cb);
            }
        }
    
        return through2.obj(wrapper);
    }
}

module.exports = resumethrough;