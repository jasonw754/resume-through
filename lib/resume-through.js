const through2 = require("through2");
const uuid = require("uuid/v1");

function resumethrough(transformation) {
    const surrogate = function (chunk, enc, cb) {
        chunk.__resume_through = {uuid: uuid()};
        transformation(chunk, enc, cb);
    }

    return through2.obj(surrogate);
}

module.exports = resumethrough;