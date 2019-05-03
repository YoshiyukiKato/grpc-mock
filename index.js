const { createServer } = require('grpc-kit');
const { Metadata } = require('grpc');
const UNEXPECTED_INPUT_PATTERN_ERROR = {
  code: 3,
  message: "unexpected input pattern"
};

function createMockServer({ rules, ...config }) {
  const routesFactory = rules.reduce((_routesFactory, { method, streamType, stream, input, output, error }) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method);
    handlerFactory.addRule({ method, streamType, stream, input, output, error });
    return _routesFactory;
  }, new RoutesFactory());
  const routes = routesFactory.generateRoutes();
  const grpcServer = createServer();

  grpcServer.getInteractionsOn = (method) => routes[method].interactions;
  grpcServer.clearInteractions = () => Object.keys(routes).forEach(method => routes[method].interactions.length = 0);

  return grpcServer.use({ ...config, routes });
}

class RoutesFactory {
  constructor() {
    this.routebook = {};
  }

  getHandlerFactory(method) {
    return this.routebook[method];
  }

  initHandlerFactory(method) {
    this.routebook[method] = new HandlerFactory();
    return this.routebook[method];
  }

  generateRoutes() {
    return Object.entries(this.routebook).reduce((_routes, [method, handlerFactory]) => {
      _routes[method] = handlerFactory.generateHandler();
      return _routes;
    }, {});
  }
}

const prepareMetadata = error => {
  let errorFields = Object.entries(error);
  if (error.metadata) {
    const grpcMetadata = Object.entries(error.metadata)
      .reduce((m, [k, v]) => (m.add(k, String(v)), m), new Metadata());
    errorFields = [
      ...errorFields,
      ['metadata', grpcMetadata],
    ];
  }
  return errorFields.reduce((e, [k, v]) => (e[k] = v, e), new Error());
};

class HandlerFactory {
  constructor() {
    this.rules = [];
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  generateHandler() {
    let interactions = [];
    const handler = function (call, callback) {
      var last = {
          count: this.rules.length,
          output: undefined,
          error: undefined,
      };
      console.log(JSON.stringify(this.rules.length))
      console.log(JSON.stringify(this.rules));
      for (const { streamType, stream, input, output, error } of this.rules) {
        if (streamType === 'client') {
          // give each rule handler its own "done" variable, so it knows
          // when it has processed to an result
          (function () {
            var done = false
            call.on('data', function (memo, data) {
              if (!done) {
                memo.push(data);
                interactions.push(data);
  
                const included = memo.reduce((_matched, memoData, index) => {
                  if(stream[index]){
                    return _matched && isMatched(memoData, stream[index].input);
                  }else{
                    return false;
                  }
                }, true);
                const matched = included && memo.length === stream.length;
  
                if (matched) {
                  if (error) {
                    last.error = error;
                    last.count = last.count - 1;
                    done = true
                    //callback(prepareMetadata(error));
                  } else {
                      last.output = output;
                    last.count = last.count - 1;
                    done = true
                    //callback(null, output);
                  }
                } else if(included) {
                  //nothing todo
                } else {
                  last.count = last.count - 1;
                  done = true;
                }
              }
              if (last.count == 0) {
                // set to -1 so no one else attempts to set the output
                last.count = -1
                if (last.output) {
                  callback(null, last.output);
                } else if (last.error) {
                  callback(prepareMetadata(last.error));
                } else {
                  callback(prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
                }
              }
            }.bind(null, []));
          })();
        } else if (streamType === 'server') {
          interactions.push(call.request);
          if (isMatched(call.request, input)) {
            last.unexpected = false;
            last.streamType = 'server';
            if (error) {
              call.emit('error', prepareMetadata(error));
            } else {
              for (const { output } of stream) {
                call.write(output);
              }
            }
            call.end();
            break; // allow only a single match
          } else {
            last.streamType = 'server';
          }
        } else if (streamType === 'mutual') {
          call.on('data', function (stream, memo, data) {
            memo.push(data);
            interactions.push(data);

            if (error) {
              call.emit('error', prepareMetadata(error));
            } else if (stream && stream[0] && !stream[0].input) {
              const { output } = stream.shift();
              call.write(output);
            } else if (stream && stream[0] && isMatched(memo[0], stream[0].input)) {
              last.unexpected = false;
              last.streamType = 'mutual';
              memo.shift();
              const { output } = stream.shift();
              call.write(output);
            } else {
              //TODO: raise error
              call.emit('error', prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
              call.end();
            }

            if (stream.length === 0) {
              call.end();
            }
          }.bind(null, [...stream], []));
        } else {
            interactions.push(call.request);
          if (isMatched(call.request, input)) {
            last.unexpected = false
            if (error) {
              last.error = error;
              //callback(prepareMetadata(error));
            } else {
              last.output = output;
              //callback(null, output);
            }
          }
          last.count = last.count - 1;
          console.log(JSON.stringify(last))
          if (last.count == 0) {
            if (last.output) {
              callback(null, last.output);
            } else if (last.error) {
              callback(prepareMetadata(last.error));
            } else {
              callback(prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
            }
          }
        }
      }
            /*
      if (last.unexpected) {
          console.log("AT THE END: " + JSON.stringify(last))
          if (last.streamType == 'server') {
              call.emit('error', prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
              call.end();
          } else if (last.streamType == 'unary') {
              callback(prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
          }
      }*/
    }.bind(this);
    handler.interactions = interactions;
    return handler;
  }

}

function isMatched(actual, expected) {
  if (typeof expected === 'string') {
    return JSON.stringify(actual).match(new RegExp(expected));
  } else {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
}

exports.createMockServer = createMockServer;
