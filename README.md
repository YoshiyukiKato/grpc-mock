# grpc-mock
[![npm version](https://badge.fury.io/js/grpc-mock.svg)](https://badge.fury.io/js/grpc-mock)

A simple mock gRPC server on Node.js.

```js
const {createMockServer} = require("grpc-mock");
const mockServer = createMockServer({
  protoPath: "/path/to/greeter.proto",
  packageName: "greeter",
  serviceName: "Greeter",
  rules: [
    { method: "hello", input: { message: "test" }, output: { message: "Hello" } },
    { method: "goodbye", input: ".*", output: { message: "Goodbye" } },
    
    {
      method: "howAreYou",
      streamType: "client",
      stream: [
        { input: { message: "Hi" } },
        { input: { message: "How are you?" } },
      ],
      output: { message: "I'm fine, thank you" }
    },
    
    {
      method: "niceToMeetYou",
      streamType: "server",
      stream: [
        { output: { message: "Hi, I'm Sana" } },
        { output: { message: "Nice to meet you too" } },
      ],
      input: { message: "Hi. I'm John. Nice to meet you" }
    },
    
    {
      method: "chat",
      streamType: "mutual",
      stream: [
        { input: { message: "Hi" }, output: { message: "Hi there" } },
        { input: { message: "How are you?" }, output: { message: "I'm fine, thank you." } },
      ]
    },
    
    { method: "returnsError", input: { }, error: { code: 3, message: "Message text is required"} },
    
    {
      method: "returnsErrorWithMetadata",
      streamType: "server",
      input: { },
      error: { code: 3, message: "Message text is required", metadata: { key: "value"}}
    }
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
  rpc HowAreYou (stream RequestGreet) returns (ResponseGreet) {}
  rpc NiceToMeetYou (RequestGreet) returns (stream ResponseGreet) {}
  rpc Chat (stream RequestGreet) returns (stream ResponseGreet) {}
}

message RequestGreet {
  string message = 1;
}

message ResponseGreet {
  string message = 1;
}
```

## api
### createMockServer({`protoPath`,`packageName`,`serviceName`,`options`,`rules`}): [grpc-kit](https://github.com/YoshiyukiKato/grpc-kit).GrpcServer

|arg name|type|required/optional|description|
|:-------|:---|:----------------|:----------|
|**`protoPath`**|String|Required|path to `.proto` file|
|**`packageName`**|String|Required|name of package|
|**`serviceName`**|String|Required|name of service|
|**`options`**|@grpc/proto-loader.Options|Optional|options for `@grpc/proto-loader` to load `.proto` file. In detail, please check [here](https://github.com/grpc/grpc-node/blob/master/packages/proto-loader/README.md) out. Default is `null`|
|**`rules`**|Array\<Rule\>|Required|Array of Rules|

### Rule
|prop name|type|required/optional|description|
|:-------|:---|:----------------|:----------|
|**`method`**|String|Required|path to `.proto` file|
|**`streamType`**|Enum<"client"\|"server"\|"mutual">|Optional|Type of stream. Set `client` if only using client side stream, set `server` if only using server side stream, and set `mutual` if using both of client and server side stream. Set null/undefined if not using stream. Default is null|
|**`input`**|Object\|String|Required when `streamType` is null or `server`|Specifying an expected input. Raw object or pattern string(RegExp) is available|
|**`output`**|String|Required when `streamType` is null or `client`|Specifying an output to an expected input|
|**`stream`**|Array\<Chunk\>|Required when `streamType` is `client`, `server` and `mutual`|Array of Chunks|
|**`error`**|Object|Optional|If provided, server will respond with this error object|

#### Chunk
|prop name|type|required/optional|description|
|:-------|:---|:----------------|:----------|
|**`input`**|Object\|String|Required when `streamType` is `client`. Optional when `streamType` is `mutual`|Specifying an expected input. Raw object or pattern string(RegExp) is available.|
|**`output`**|Object|Required when `streamType` is `server`. Optional when `streamType` is `mutual`|Specifying an output to an expected input|
