[![Package Version](https://img.shields.io/npm/v/execs.svg)](https://www.npmjs.org/package/execs) [![Build Status](https://travis-ci.org/NexusTools/node-execs.svg)](https://travis-ci.org/NexusTools/node-execs) [![Apache License 2.0](http://img.shields.io/hexpm/l/plug.svg)](http://www.apache.org/licenses/LICENSE-2.0.html) [![Coverage Status](https://img.shields.io/coveralls/NexusTools/node-execs.svg)](https://coveralls.io/r/NexusTools/node-execs) [![Gratipay Tips](https://img.shields.io/gratipay/NexusTools.svg)](https://gratipay.com/NexusTools/)

node-execs
----------
node-execs makes it easy to execute multiple processes at once with a synchronous and asynchronous API.

```
npm install -g execs
```

usage
-----
```
var execs = require("execs");
var i = execs([["echo", "Hello World"], ["echo, "FooBar"]]);
i.waitFor(); // Wait until execution completes
console.log(i.readlog(0)); // Dump command 1 output
console.log(i.readlog(1)); // Dump command 1 output
```

asynchronous usage is not complete yet.

legal
-----
node-typeinclude is licensed under [Apache License 2.0](LICENSE.md)
