const through2 = require("through2");

function resumethrough(transformation) {
    const surrogate = function (chunk, enc, cb) {
        transformation(chunk, enc, cb);
    }

    return through2.obj(surrogate);
}

module.exports = resumethrough;