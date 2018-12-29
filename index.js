const {createServer} = require("grpc-kit");

function createMockServer({rules, ...config}){
  const routesFactory = rules.reduce((_routesFactory, {method,input,output}) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method).getHandlerFactory(method);
    handlerFactory.addRule(input, output);
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
    return this;
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
    this.rulebook = {};
  }
  
  addRule({input, output}){
    this.rulebook[JSON.stringify(input)] = output;
  }

  generateHandler(){
    return async function(call, callback){
      return this.rulebook[JSON.stringify(input)];
    }
  }
}

exports.createMockServer = createMockServer;