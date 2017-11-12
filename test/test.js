var expect = require("chai").expect;

const through2 = require("through2");
const Readable = require("readable-stream").Readable;

const resumethrough = require('../lib/resume-through');

describe("Resume Through", function () {
    describe("basic through2 behavior", function () {
        it("wraps through2.obj", function (done) {
            const stream1 = Readable({objectMode: true});
            stream1._read = () => {};
            
            const stream2 = Readable({objectMode: true});
            stream2._read = () => {};

            const doubleIt = function (chunk, enc, cb) {
                chunk.x *= 2;
                cb(null, chunk);
            }

            const unwrapped = through2.obj(doubleIt);
            const wrapped = resumethrough(doubleIt);

            stream1
                .pipe(unwrapped)
                .pipe(through2.obj(function (chunk, enc, cb) {
                    expect(chunk.x).to.equal(10);
                    
                    stream2.push({x: 5});
                }));

            stream2
                .pipe(wrapped)
                .pipe(through2.obj(function (chunk, enc, cb) {
                    expect(chunk.x).to.equal(10);
                    done();
                }));
            
            stream1.push({x: 5});
        })
    })
})