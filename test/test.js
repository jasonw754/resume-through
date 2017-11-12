var expect = require("chai").expect;

const through2 = require("through2");
const Readable = require("readable-stream").Readable;

const resumethrough = require('../lib/resume-through');

describe("Resume Through", function () {
    describe("basic through2 behavior", function () {
        it("wraps through2.obj", function (done) {
            /* 
             * Make two streams and one transformation function.
             * Pipe the transformation onto stream 1 by just using through2.
             * Pipe the same transformation onto stream 2 using the resume-through wrapper.
             * Push an identical object on each stream and expect the same result from both.
             */
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
        });
    });
    
    describe("data chunk identity", function () {

        it ("adds an identifier to the data chunk", function (done) {
            /*
             * By default, resume-through will just add a property named '__resume_through' to the data chunk.
             * Expect the property to be there.
             */
            const stream = Readable({objectMode: true});
            stream._read = () => {};

            const rt = resumethrough(function (chunk, enc, cb) {
                cb(null, chunk);
            });

            stream.pipe(rt).pipe(through2.obj(function (chunk, enc, cb) {
                expect(chunk).to.have.property('__resume_through');
                done();
            }))

            stream.push({});
        });
    });
});