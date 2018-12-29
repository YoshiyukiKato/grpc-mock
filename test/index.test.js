const path = require("path");
const assert =require("power-assert");
const {hello, goodbye} = require("./fixture/greeter-client");
const {createMockServer} = require("../index");
const protoPath = path.resolve(__dirname, "./fixture/greeter.proto");
const packageName = "greeter";
const serviceName = "Greeter";
const mockServer = createMockServer({
  protoPath,
  packageName,
  serviceName,
  rules: [
    { method: "hello", input: { name: "test" }, output: { message: "Hello" } },
    { method: "goodbye", input: { name: "test" }, output: { message: "Goodbye" } }
  ]
});

describe("grpc-mock", () => {
  before((done) => {
    mockServer.listen("0.0.0.0:50051");
    done();
  });

  it("responds Hello", () => {
    return hello({ name : "test" })
      .then((res) => {
        assert(res.message === "Hello");
      })
      .catch(assert);
  });

  it("responds Goodbye", () => {
    return goodbye({ name : "test" })
      .then((res) => {
        assert(res.message === "Goodbye");
      })
      .catch(assert);
  });

  after((done) => {
    mockServer.close(false, () => {});
    done();
  });
});