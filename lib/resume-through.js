const through2 = require("through2");
const uuid = require("uuid/v1");

function resumethrough(options) {
    if (typeof options === 'function') {
        let transformation = options;
        options = {};
        return createSurrogate(options)(transformation);
    } else if (typeof options === 'object') {
        return createSurrogate(options);
    }
}

const defaults = {
    identifier: uuid
}

function createSurrogate(options) {

    options = Object.assign(defaults, options);

    const getOptions = function() {
        return options;
    }

    return function (transformation) {
        const surrogate = function (chunk, enc, cb) {
            chunk.__resume_through = {
                getOptions: getOptions,
                id: options.identifier()
            };
            transformation(chunk, enc, cb);
        }
    
        return through2.obj(surrogate);
    }
}

module.exports = resumethrough;