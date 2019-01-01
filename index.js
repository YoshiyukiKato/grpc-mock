const {createServer} = require("grpc-kit");

function createMockServer({rules, ...config}){
  const routesFactory = rules.reduce((_routesFactory, {method,type,input,output}) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method).getHandlerFactory(method);
    handlerFactory.addRule({method,type,input,output});
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
    this.rules = [];
  }
  
  addRule(rule){
    this.rules.push(rule);
  }

  generateHandler(){
    return async function(call, callback){
      for(let rule of this.rules){
        if(rule.type === "pattern"){
          if(JSON.stringify(call.request).match(new RegExp(rule.input))){
            return rule.output;
          };
        }else{
          if(JSON.stringify(rule.input) === JSON.stringify(call.request)) {
            return rule.output;
          }
        }
      }
      //if no rules matched
      return {};
    }.bind(this);
  }
}

exports.createMockServer = createMockServer;