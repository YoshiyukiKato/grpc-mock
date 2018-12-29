# grpc-mock
A simple mock gRPC server on Node.js.

```js
const {createMockServer} = require("grpc-mock");
const mockServer = createMockServer({
  protoPath: "/path/to/greeter.proto",
  packageName: "greeter",
  serviceName: "Greeter",
  rules: [
    { method: "hello", input: { name: "test" }, output: { message: "Hello" } },
    { method: "goodbye", input: { name: "test" }, output: { message: "Goodbye" } }
  ]
});
mockServer.listen("0.0.0.0:50051");
```

```proto
syntax="proto3";

package greeter;

service Greeter {
  rpc Hello (RequestGreet) returns (ResponseGreet) {}
  rpc Goodbye (RequestGreet) returns (ResponseGreet) {}
}

message RequestGreet {
  string name = 1;
}

message ResponseGreet {
  string message = 1;
}
```