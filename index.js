const {createServer} = require("grpc-kit");

function createMockServer({rules, ...config}){
  const routesFactory = rules.reduce((_routesFactory, {method,input,output}) => {
    const handlerFactory = _routesFactory.getHandlerFactory(method)
      || _routesFactory.initHandlerFactory(method);
    handlerFactory.addRule({method,input,output});
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
      for(let rule of this.rules){
        const respond = rule.output.stream ? call.write.bind(call) : (res) => { callback(null, res); };
        if(rule.input.stream){
          call.on("data", (err, data) => {
            if(err) {
              throw err;
            } else {
              handleRequest(rule, respond, data);
            }
          });
          
          call.on("end", () => {
            call.end();
          });
        }else{
          handleRequest(rule, respond, call.request);
        }
      }
      //if no rules matched
      //callback(null, {});
    }.bind(this);
  }
}

function handleRequest(rule, respond, data){
  if(typeof rule.input.body === "string") {
    if(JSON.stringify(data).match(new RegExp(rule.input.body))) {
      respond(rule.output.body);
    }
  } else {
    if(JSON.stringify(data) === JSON.stringify(rule.input.body)) {
      respond(rule.output.body);
    }
  }
}

exports.createMockServer = createMockServer;