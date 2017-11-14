const through2 = require("through2");
const uuid = require("uuid/v1");

const ResumeThrough = require("./lib/resume-through");

function resumethrough(options) {
    if (!options) {
        return wrapStream({});
    } else if (typeof options === 'function') {
        let transformation = options;
        options = {};
        return wrapStream(options)(transformation);
    } else if (typeof options === 'object') {
        return wrapStream(options);
    }
}

const defaults = {
    identifier: uuid
}

function wrapStream(options) {

    options = Object.assign(defaults, options);

    return function (name, transformation) {
        if (typeof name === 'function' && ! transformation) {
            transformation = name;
        }

        const wrapper = function (chunk, enc, cb) {
            if (!chunk.__resume_through) {
                chunk.__resume_through = new ResumeThrough(options, chunk);
            }
            let ticket = chunk.__resume_through;
            ticket.history.push(name);
            transformation(chunk, enc, cb);
        }
    
        return through2.obj(wrapper);
    }
}

module.exports = resumethrough;