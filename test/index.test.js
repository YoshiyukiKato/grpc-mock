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
    { method: "goodbye", input: ".*", output: { message: "Goodbye" } },
    
    {
      method: "howAreYou",
      streamType: "client",
      dialogue: [
        { input: { message: "Hi" } },
        { input: { message: "How are you?" } },
      ],
      output: { message: "I'm fine, thank you" }
    },
    
    {
      method: "howAreYou",
      streamType: "server",
      dialogue: [
        { output: { message: "I'm fine" } },
        { output: { message: "thank you" } },
      ],
      input: { message: "Hi, how are you?" }
    },
    
    {
      method: "howAreYou",
      streamType: "mutual",
      dialogue: [
        { input: { message: "Hi" }, output: { message: "Hi dear" } },
        { input: { message: "How are you?" }, output: { message: "I'm fine, thank you." } },
      ]
    }
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
    return goodbye({})
      .then((res) => {
        assert(res.message === "Goodbye");
      })
      .catch(assert);
  });

  describe("client stream", () => {
    it("responds how are you", () => {
      assert(false);
    });
  });
  
  describe("server stream", () => {
    it("responds how are you", () => {
      assert(false);
    });
  });
  
  describe("mutual stream", () => {
    it("responds how are you", () => {
      assert(false);
    });
  });

  after((done) => {
    mockServer.close(false, () => {
      done();
    });
  });
});