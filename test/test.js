var expect = require("chai").expect;

const through2 = require("through2");
const Readable = require("readable-stream").Readable;
const miss = require('mississippi');
const fs = require('fs');
const rimraf = require('rimraf');

const resumethrough = require('../index');

describe("Resume Through", function () {

    afterEach(function () {
        rimraf.sync('.resume-through');
    })

    describe("basic through2 behavior", function () {

        it("wraps through2.obj", function (done) {
            /**
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

    describe("configurable options", function () {

        it("allows options to be passed", function(done) {
            const stream = Readable({objectMode: true});
            stream._read = () => {};
            
            const rt = resumethrough({foo: "bar"})

            stream.pipe(rt(function (chunk, enc, cb) {
                expect(chunk).to.have.property('__resume_through');
                expect(chunk.__resume_through).to.have.property('_options');
                expect(chunk.__resume_through._options).to.have.property('foo');
                done();
                cb();
            }));

            stream.push({});
        })
    })
    
    describe("data chunk identity", function () {

        it("adds an identifier to the data chunk", function (done) {
            /**
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

        it("uses uuid for the identifier by default", function (done) {
            /**
             * By default, resume-through will use uuid/v1 to make a unique identifying value for each
             * data chunk that passes through.
             * To test this, make a set of 3 objects that will get pushed on the stream one after another
             * and then once they're all finished check to make sure they're all unique
             */
            const stream = Readable({objectMode: true});
            stream._read = () => {};

            let count = 0;
            const rt = resumethrough(function (chunk, enc, cb) {
                cb(null, chunk);
            });

            stream.pipe(rt).pipe(through2.obj(function (chunk, enc, cb) {
                if (++count == inputs.length) {
                    // all are done, compare them
                    for (let i = 0; i < count; i++) {
                        expect(inputs[i].__resume_through).to.have.property('id');
                        for (let j = 0; j < count; j++) {
                            if (i == j) continue;
                            expect(inputs[i].__resume_through.id).not.to.equal(inputs[j].__resume_through.id);
                        }
                    }
                    done();
                }
                cb();
            }));

            const inputs = [{},{},{}];

            for (let i = 0; i < inputs.length; i++) {
                stream.push(inputs[i]);
            }
        });

        it("allows the developer to provide an identifier generator", function (done) {
            /**
             * Resume Through will allow options and one option should be to allow the developer
             * to provide an implementation for the identifier.
             */
            const stream = Readable({objectMode: true});
            stream._read = () => {};
            
            const rt = resumethrough({
                identifier: function() {
                    return 'A';
                }
            });

            stream.pipe(rt(function(chunk, enc, cb) {
                expect(chunk.__resume_through.id).to.equal('A');
                done();
                cb();
            }));

            stream.push({});
        });

        it("allows the developer to provide the name of an existing field for the identifier", function (done) {
            /**
             * If the developer already has a unique field on the data chunk, it can be used
             * as the id by providing the field name for the identifier config option.
             */
            const stream = Readable({objectMode: true});
            stream._read = () => {};

            const rt = resumethrough({
                identifier: 'id'
            });

            stream.pipe(rt(function(chunk, enc, cb) {
                expect(chunk.__resume_through.id).to.equal(chunk.id);
                done();
                cb();
            }));

            stream.push({id: 123});
        })
    });

    describe("pipeline structure & metadata", function () {

        it("will return a pipeline when multiple streams are passed", function (done) {
            startWith({}).pipe(
                resumethrough(
                    through2.obj(function (chunk, enc, cb) {
                        chunk.a = 1;
                        cb(null, chunk);
                    }),
                    through2.obj(function (chunk, enc, cb) {
                        expect(chunk).to.have.property('a');
                        chunk.b = 2;
                        cb(null, chunk);
                    }),
                    through2.obj(function (chunk, enc, cb) {
                        expect(chunk).to.have.property('b');
                        chunk.c = 3;
                        cb(null, chunk);
                    })
                )
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                expect(chunk).to.have.property('a');
                expect(chunk).to.have.property('b');
                expect(chunk).to.have.property('c');
                cb();
                done();
            }));
        });

        it("will return a pipeline when multiple transform functions are passed", function (done) {
            startWith({}).pipe(
                resumethrough(
                    function (chunk, enc, cb) {
                        chunk.a = 1;
                        cb(null, chunk);
                    },
                    function (chunk, enc, cb) {
                        expect(chunk).to.have.property('a');
                        chunk.b = 2;
                        cb(null, chunk);
                    },
                    function (chunk, enc, cb) {
                        expect(chunk).to.have.property('b');
                        chunk.c = 3;
                        cb(null, chunk);
                    }
                )
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                expect(chunk).to.have.property('a');
                expect(chunk).to.have.property('b');
                expect(chunk).to.have.property('c');
                cb();
                done();
            }));
        });

        it("will generate identity for each stream and add history to the chunk", function (done) {
            startWith({}).pipe(
                resumethrough(
                    function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    function (chunk, enc, cb) {
                        cb(null, chunk);
                    }
                )
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                expect(chunk.__resume_through).to.have.property('history');
                expect(chunk.__resume_through.history.length).to.eq(3);
                let history = chunk.__resume_through.history;
                for (let i = 0; i < history.length; i++) {
                    for (let j = 0; j < history.length; j++) {
                        if (i != j) {
                            expect(history[i]).not.to.eq(history[j]);
                        }
                    }
                }
                cb();
                done();
            }));
        });

        it("lets the developer provide a name for each stream", function (done) {
            let rt = resumethrough();
            
            startWith({}).pipe(
                rt({
                    "b1" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    "b2" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    "b3" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    }
                })
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                expect(chunk.__resume_through).to.have.property('history');
                expect(chunk.__resume_through.history.length).to.eq(3);
                let history = chunk.__resume_through.history;
                for (let i = 0; i < history.length; i++) {
                    expect(chunk.__resume_through.history[i]).to.eq("b" + (i + 1));
                }
                cb();
                done();
            }));
        });

        it("suppresses the inspector chunk from the end of the pipeline", function (done) {
            let rt = resumethrough();
            
            startWith({}).pipe(
                rt({
                    "b1" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    "b2" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    "b3" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    }
                })
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                if (chunk.__resume_through_inspector) {
                    expect.fail();
                }
                done();
            }));
        });
    });

    describe("resumable stream behavior", function () {
        
        it("skips transforms if the data has a previous state showing it's already been processed", function (done) {
            let rt = resumethrough();

            startWith({
                __resume_through: {
                    history: [
                        "a1",
                        "a2"
                    ]
                },
                value: 2
            }).pipe(
                rt({
                    "a1": function (chunk, enc, cb) {
                        chunk.value += 2;
                        cb(null, chunk);
                    },
                    "a2": function (chunk, enc, cb) {
                        chunk.value += 2;
                        cb(null, chunk);
                    },
                    "a3": function (chunk, enc, cb) {
                        chunk.value += 2;
                        cb(null, chunk);
                    }
                })
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                expect(chunk.value).to.eq(4);
                expect(chunk.__resume_through).to.have.property('history');
                expect(chunk.__resume_through.history.length).to.eq(3);
                let history = chunk.__resume_through.history;
                for (let i = 0; i < history.length; i++) {
                    expect(chunk.__resume_through.history[i]).to.eq("a" + (i + 1));
                }
                cb();
                done();
            }));
        });

        it("persists the stream state to disk by default", function (done) {
            let rt = resumethrough();
            
            startWith({}).pipe(
                rt({
                    "b1" : function (chunk, enc, cb) {
                        cb(null, chunk);
                        expect(fs.existsSync('.resume-through/' + chunk.__resume_through.id)).to.be.true;
                    },
                    "b2" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    },
                    "b3" : function (chunk, enc, cb) {
                        cb(null, chunk);
                    }
                })
            ).pipe(miss.to.obj(function(chunk, enc, cb) {
                if (chunk.__resume_through_inspector) {
                    expect.fail();
                }
                done();
            }));
        })
    });
});

function startWith(data) {
    return miss.from.obj(function (size, next) {
        let chunk = data;
        data = null;
        next(null, chunk);
    });
}