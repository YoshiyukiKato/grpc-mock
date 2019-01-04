const {createServer} = require("grpc-kit");

function createMockServer({rules, ...config}){
  const routesFactory = rules.reduce((_routesFactory, {method,streamType,dialogue,input,output}) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method);
    handlerFactory.addRule({method,streamType,dialogue,input,output});
    return _routesFactory;
  }, new RoutesFactory());
  const routes = routesFactory.generateRoutes();
  return createServer().use({...config, routes});
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
    return function(call, callback){
      for(const {streamType,dialogue,input,output} of this.rules){
        if(streamType === "client") {
          call.on("data", function(memo, data) {
            memo.push(data);
            const matched = dialogue.reduce((_matched, chunk, index) => {
              if(memo[index]){
                return _matched && isMatched(memo[index], chunk.input);
              }else{
                return false;
              }
            }, true);

            if(matched){
              callback(null, output);
            }
          }.bind(null, []));
        } else if (streamType === "server") {
          if(isMatched(call.request, input)){
            for(const {output} of dialogue){
              call.write(output);
            }
            call.end();
          }
        } else if (streamType === "mutual") {
          call.on("data", function(dialogue, memo, data) {
            memo.push(data);
            if(!dialogue[0].input){
              const {output} = dialogue.shift();
              call.write(output);
            } else if (isMatched(memo[0], dialogue[0].input)) {
              memo.shift();
              const {output} = dialogue.shift();
              call.write(output);
            }else{
              call.end();
            }

            if(dialogue.length === 0){
              call.end();
            }
          }.bind(null, [...dialogue], []));
        } else {
          if(isMatched(call.request, input)){
            callback(null, output);
          }
        }
      }
    }.bind(this);
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