if(require.main === module)
    throw new Error("execs is a library and has no runnable functionality");

var child_process = require("child_process");
var usleep = require('sleep').usleep;
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var os = require('os');

var tempDirectory = path.resolve(os.tmpdir(), "execs-cache");

var singleQuote = /'/g;
var needQuote = /[^\w\/\.\-]/;
function escapeSegment(segment) {
    if(needQuote.test(segment)) {
        segment.replace(singleQuote, "\'");
        segment = "'" + segment + "'";
        return segment;
    }
    return segment;
}

function exec(command, args, log, complete, verbose) {
    var cmdline = escapeSegment(command);
    if(args) {
        if(!(args instanceof Array))
            args = [String(args)];
        args.forEach(function(arg) {
            cmdline += " ";
            cmdline += escapeSegment(arg);
        });
    }
    
    if(complete instanceof Function)
        throw new Error("async usage not implemented yet");
    else {
        complete = complete && String(complete).trim() || tempDirectory;
        mkdirp.sync(complete, 0777);
        var finished = false;
        
        if(log === true)
            log = path.resolve(complete, "execs-" + Date.now() + "." + "log");
        else if(!log)
            log = "/dev/null";
        complete = path.resolve(complete, "execs-" + Date.now() + "." + "fin");
        cmdline += " 2>&1 > ";
        cmdline += escapeSegment(log);
        
        cmdline += "; echo $? > ";
        cmdline += escapeSegment(complete);
        if(verbose && verbose.preExec)
            verbose.preExec(cmdline);
        var child = child_process.exec(cmdline);
        if(!child)
            throw new Error("Failed to spawn child_process");
        if(verbose && verbose.onExec)
            verbose.onExec(cmdline, child.pid);
        var error;
    
        var waitFor;
        var update = function() {
            if(!finished) {
                if(finished = fs.existsSync(complete)) {
                    try {
                        var statusCode = fs.readFileSync(complete, {encoding:"utf8"});
                        statusCode = statusCode.trim()*1;
                        if(verbose && verbose.onExit)
                            verbose.onExit(statusCode);
                        if(statusCode != 0)
                            throw "Exited with status code " + statusCode + ".";
                    } catch(e) {
                        if(!error)
                            error = String(e);
                    } finally {
                        try {
                            fs.unlinkSync(complete);
                        } catch(e) {}
                        if(verbose) {
                            if(error) {
                                if(verbose.onError)
                                    verbose.onError(statusCode);
                            } else if(verbose.onSuccess)
                                verbose.onSuccess();
                        }
                    }
                }
            }
            
            return finished;
        }
        var kill = function() {
            if(finished)
                return;
            
            error = "Terminated";
            child.kill("SIGTERM");
            usleep(200);
            try {
                child.kill("SIGKILL"); // ensure it dies, hopefully either throws or will throw an error in the future...
                error = "Killed";
            } catch(e) {}
            finished = true;
            if(verbose) {
                if(verbose.onExit)
                    verbose.onExit(1);
                if(verbose.onError)
                    verbose.onError(1);
            }
            delete child;
        }
        waitFor = function(timeout/*seconds float*/, interval, dontKillOnTimeout) {
            if(finished)
                return;

            interval = interval || Math.min(400, Math.max(40, timeout/8));
            timeout = timeout || Number.MAX_VALUE/1000;
            var endAt = Date.now() + (timeout*1000);
            do {
                if(update())
                   break;
                if(Date.now() >= endAt) {
                    if(!dontKillOnTimeout)
                        kill();
                    break;
                }
                usleep(interval);
            } while(true);
        }
        
        return {
            "kill": kill,
            "error": function() {
                return error;
            },
            "cmdline": function() {
                return cmdline;
            },
            "readlog": function() {
                try {
                    return fs.readFileSync(log, {encoding:"utf8"});
                } catch(e) {
                    if(e.code == "ENOENT")
                        return "";
                    throw e;
                }
            },
            "takelog": function() {
                try {
                    var logdata = fs.readFileSync(log, {encoding:"utf8"});
                    fs.unlinkSync(log)
                    return logdata;
                } catch(e) {
                    if(e.code == "ENOENT")
                        return "";
                    throw e;
                }
            },
            "clearlog": function() {
                try {
                    fs.unlinkSync(log);
                } catch(e) {
                    if(e.code != "ENOENT")
                        throw e;
                }
            },
            "waitFor": waitFor,
            "update": update,
            "isFinished": function() {
                return finished;
            },
            "toString": function() {
                return complete;
            }
        };
    }
}

function execs(commands, complete, verbose) {
    if(complete instanceof Function)
        throw new Error("async usage not implemented yet");
    else {
        var errors = [];
        var processes = [];
        var activeProcesses = [];
         var verboseWrap;
        commands.forEach(function(command) {
            var proc;
            if(verbose) {
                verboseWrap = {};
                if(verbose.onExit)
                    verboseWrap.onExit = function(status) {
                        verbose.onExit(proc, status);
                    }
                if(verbose.onError)
                    verboseWrap.onError = function(status) {
                        verbose.onError(proc, status);
                    }
                if(verbose.onSuccess)
                    verboseWrap.onSuccess = function() {
                        verbose.onSuccess(proc);
                    }
            }
            if(command instanceof Array)
                proc = exec(command[0], command[1] || [], command[2] ||
                    undefined, command[3] || complete || undefined, verboseWrap);
            else
                proc = exec(String(command), [],
                            undefined, complete, verboseWrap);
            processes.push(proc);
        });
        if(verbose && verbose.started)
            verbose.started(processes.length);
        activeProcesses = processes.slice(0);
        
        var isFinished = function() {
            return !activeProcesses.length
        }
        var update = function() {
            if(activeProcesses.length) {
                var stillActive = [];
                activeProcesses.forEach(function(proc) {
                    if(!proc.update())
                        stillActive.push(proc);
                    else {
                        var error = proc.error();
                        if(error)
                            errors.push([proc.cmdline(), error]);
                    }
                });
                activeProcesses = stillActive;
            }
            return !activeProcesses.length;
        }
        var kill = function() {
            activeProcesses.forEach(function(proc) {
                proc.kill();
                errors.push([proc.cmdline(), proc.error()]);
            });
            activeProcesses = [];
        }
        
        return {
            "kill": kill,
            "waitFor": function(timeout, interval, dontKillOnTimeout) {
                if(isFinished())
                    return;
                
                timeout = timeout || Number.MAX_VALUE/1000;
                var endAt = Date.now() + (timeout*1000);
                do {
                    if(update())
                       break;
                    if(Date.now() >= endAt) {
                        if(!dontKillOnTimeout)
                            kill();
                        break;
                    }
                } while(true);
            },
            "isFinished": isFinished,
            "update": update,
            "active": function() {
                return activeProcesses.length;
            },
            "errors": function() {
                return errors;
            },
            "readlog": function(id) {
                return processes[id].readlog();
            },
            "total": function() {
                return processes.length;
            },
            "getProcesses": function() {
                return processes.slice(0);
            },
            "toString": "execsProcessBundle(" + processes.length + ")"
        };
    }
};
execs.single = exec;
module.exports = execs;