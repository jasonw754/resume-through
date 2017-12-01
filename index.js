const through2 = require("through2");
const uuid = require("uuid/v1");
const miss = require("mississippi");
const jsonfile = require("jsonfile");
const fs = require("fs");

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
    identifier: uuid,
    saveState: function (data) {
        if (!data.__resume_through.id) {
            return;
        }
        if (!fs.existsSync('.resume-through')) {
            fs.mkdirSync('.resume-through');
        }
        jsonfile.writeFile(
            '.resume-through/' + data.__resume_through.id, 
            data,
            {
                replacer: function (key, value) {
                    if (key == '_chunk') {
                        return undefined;
                    }
                    return value;
                }
            },
            function (err) {
                if (err) {
                    console.error(err);
                }
            }
        )
    }
}

function wrap(options, ...transforms) {

    let tmp = Object.assign({}, defaults);
    options = Object.assign(tmp, options);

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

        let wrappedTransforms = transforms.map(wrapTransform);
        wrappedTransforms.push(through2.obj(function (chunk, enc, cb) {
            if (chunk.__resume_through_inspector) {
                cb(null, null);
            } else {
                cb(null, chunk);
            }
        }))

        const pipeline = miss.pipeline.obj(wrappedTransforms);

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
                } else {
                    // check if the data chunk has already been through this transform
                    if (chunk.__resume_through.history.includes(this.__resume_through_name)) {
                        cb(null, chunk);
                        return;
                    }
                }
                chunk.__resume_through.history.push(this.__resume_through_name);
                transform(chunk, enc, cb);
            }
        }

        const wrapped = through2.obj(wrapper);
    
        wrapped.on('data', function (data) {
            if (data.__resume_through && data.__resume_through._options) {
                data.__resume_through._options.saveState(data);
            }
        });

        return wrapped;
    }
}

module.exports = resumethrough;