const {createServer} = require("grpc-kit");


function createMockServer({rules, ...config}){
  const routesFactory = rules.reduce((_routesFactory, {method,streamType,stream,input,output,error}) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method);
    handlerFactory.addRule({method,streamType,stream,input,output,error});
    return _routesFactory;
  }, new RoutesFactory());
  const routes = routesFactory.generateRoutes();
  const grpcServer = createServer();

  grpcServer.getInteractionsOn = (method) => routes[method].interactions;
  grpcServer.clearInteractions = () => Object.keys(routes).forEach(method => routes[method].interactions.length = 0);

  return grpcServer.use({...config, routes});
}

class RoutesFactory {
  constructor() {
    this.routebook = {}
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

class HandlerFactory {
  constructor(){
    this.rules = [];
  }

  addRule(rule){
    this.rules.push(rule);
  }

  generateHandler(){
    let interactions = [];
    const handler = function(call, callback){
      for(const {streamType,stream,input,output,error} of this.rules){
        if(streamType === "client") {
          call.on("data", function(memo, data) {
            memo.push(data);
            interactions.push(data);

            const matched = stream.reduce((_matched, chunk, index) => {
              if(memo[index]){
                return _matched && isMatched(memo[index], chunk.input);
              }else{
                return false;
              }
            }, true);

            if(matched){
              if (error) {
                callback(error);
              } else {
                callback(null, output);
              }
            }
          }.bind(null, []));
        } else if (streamType === "server") {
          interactions.push(call.request);
          if(isMatched(call.request, input)){
            if (error) {
              call.emit('error', error);
            } else {
              for(const {output} of stream){
                call.write(output);
              }
            }
            call.end();
          }
        } else if (streamType === "mutual") {
          call.on("data", function(stream, memo, data) {
            memo.push(data);
            interactions.push(data);

            if(!stream[0].input){
              const {output} = stream.shift();
              call.write(output);
            } else if (isMatched(memo[0], stream[0].input)) {
              memo.shift();
              const {output} = stream.shift();
              call.write(output);
            }else{
              call.end();
            }

            if(stream.length === 0){
              call.end();
            }
          }.bind(null, [...stream], []));
        } else {
          interactions.push(call.request);

          if(isMatched(call.request, input)){
            if(error) {
              callback(error);
            } else {
              callback(null, output);
            }
          }
        }
      }
    }.bind(this);
    handler.interactions = interactions;
    return handler;
  }

}

function isMatched(actual, expected){
  if(typeof expected === "string") {
    return JSON.stringify(actual).match(new RegExp(expected));
  } else {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
}


exports.createMockServer = createMockServer;
