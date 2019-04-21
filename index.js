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
      for (const { streamType, stream, input, output, error } of this.rules) {
        if (streamType === 'client') {
          call.on('data', function (memo, data) {
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
                callback(prepareMetadata(error));
              } else {
                callback(null, output);
              }
            } else if(included) {
              //nothing todo
            } else {
              callback(prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
            }

          }.bind(null, []));
        } else if (streamType === 'server') {
          interactions.push(call.request);
          if (isMatched(call.request, input)) {
            if (error) {
              call.emit('error', prepareMetadata(error));
            } else {
              for (const { output } of stream) {
                call.write(output);
              }
            }
            call.end();
          }
        } else if (streamType === 'mutual') {
          call.on('data', function (stream, memo, data) {
            memo.push(data);
            interactions.push(data);

            if (error) {
              call.emit('error', prepareMetadata(error));
            } else if (!stream[0].input) {
              const { output } = stream.shift();
              call.write(output);
            } else if (isMatched(memo[0], stream[0].input)) {
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
            if (error) {
              callback(prepareMetadata(error));
            } else {
              callback(null, output);
            }
          } else {
            callback(prepareMetadata(UNEXPECTED_INPUT_PATTERN_ERROR));
          }
        }
      }
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
