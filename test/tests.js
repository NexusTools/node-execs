var assert = require('assert');
var child_process = require("child_process");
var path = require('path');

var execs;
var topDir = path.dirname(__dirname);
it('index.js', function(){
    execs = require(topDir + path.sep + "index");
});
describe('synchronous', function() {
    it("sleep 0.2", function() {
        var start = Date.now();
        var process = execs.single("sleep", 0.2);
        process.waitFor(0.5);
        process.waitFor(0.2, 200);
        var distance = Date.now() - start;
        if(process.error())
            throw new Error(process.error());
        if(distance < 200 || distance > 350)
            throw new Error("Command took " + distance + "ms");
    });
    var helloReg = /^Hello World/;
    it("takelog - echo \"Hello World\"", function() {
        var process = execs.single("echo", "Hello World", true);
        process.waitFor(0.1);
        if(process.error())
            throw new Error(process.error());
        assert.ok(helloReg.test(process.takelog()), "Log does not contain Hello World");
    });
    it("readlog, clearlog - echo \"Hello World\"", function() {
        var process = execs.single("echo", "Hello World", true);
        process.waitFor(0.1);
        if(process.error())
            throw new Error(process.error());
        assert.ok(helloReg.test(process.takelog()), "Log does not contain Hello World");
        process.clearlog();
        assert.ok(process.takelog() == "", "Log still contains data");
    });
    it("Kill on Timeout", function() {
        var process = execs.single("sleep", 5);
        process.waitFor(0.2);
        assert.ok(process.isFinished(), "Process did not finish");
        assert.ok(!!process.error(), "Process has no error");
    });
    it("Detect bad status code", function() {
        var process = execs.single("$--Ajjd");
        process.waitFor(0.2);
        assert.ok(process.isFinished(), "Process did not finish");
        assert.ok(!!process.error(), "Process has no error");
    });
    it("Batch execute, with verbose impl", function() {
        var exits = 0;
        var failures = 0;
        var successes = 0;
        var processes = execs(["$--Ajjd",
                            ["echo", "Hello World", true],
                            ["sleep", .1],
                            ["sleep", 5]], undefined, {
            "onError": function() {
                failures ++;
            },
            "onSuccess": function() {
                successes ++;
            },
            "onExit": function() {
                exits ++;
            }
        });
        processes.waitFor(0.2);
        assert.ok(processes.isFinished(), "Processes did not finish");
        var errorsLength = processes.errors().length;
        assert.ok(errorsLength == 2, "Expected 2 errors, got " + errorsLength);
        assert.ok(helloReg.test(processes.readlog(1)), "Second command did not contain Hello WOrld");
        assert.ok(failures == 2, "Expected 2 onError events, got " + failures);
        assert.ok(successes == 2, "Expected 2 onSuccess events, got " + successes);
        assert.ok(exits == 4, "Expected 4 onExit events, got " + exits);
    });
});
describe('asynchronous', function() {
    it("sleep 0.2");
    it("takelog - echo \"Hello World\"");
    it("readlog, clearlog - echo \"Hello World\"");
    it("Kill on Timeout");
});
