const path = require("path");
const assert = require("power-assert");
const { client, hello, goodbye } = require("./fixture/greeter-client");
const { createMockServer } = require("../index");
const protoPath = path.resolve(__dirname, "./fixture/greeter.proto");
const packageName = "greeter";
const serviceName = "Greeter";
const mockServer = createMockServer({
  protoPath,
  packageName,
  serviceName,
  rules: [
    {
      method: "hello", input: { message: "test" },
      error: {
        code: 3, message: "Wrong request", metadata: { code: 400 }
      }
    },
    {
      method: "goodbye", input: ".*",
      error: {
        code: 5, message: "Not found", metadata: { code: "404" }
      }
    },
    {
      method: "howAreYou",
      streamType: "client",
      stream: [
        { input: { message: "Hi" } },
        { input: { message: "How are you?" } },
      ],
      error: { code: 3, message: "Wrong request", metadata: { code: 400 } }
    },
    {
      method: "niceToMeetYou",
      streamType: "server",
      error: { code: 3, message: "Wrong request", metadata: { code: 400 } },
      input: { message: "Hi. I\'m John. Nice to meet you" }
    },
    {
      method: "chat",
      streamType: "mutual",
      stream: [
        {
          input: { message: "Hi" },
        },
        {
          input: { message: "How are you?" },
        },
      ],
      error: { code: 3, message: "Wrong request", metadata: { code: 400 } },
    }
  ]
});

describe("grpc-mock errors", () => {
  before((done) => {
    mockServer.listen("0.0.0.0:50051");
    done();
  });

  afterEach(() => mockServer.clearInteractions());

  it("responds with 'Wrong request' on Hello", () => {
    return hello({ message: "test" })
      .then(() => assert(false, "Shouldn't respond with payload"))
      .catch(({code, message, metadata})=>
        assert.deepEqual(
          { code, message, metadata: { code: metadata.get("code").pop() } },
          { code: 3, message: "3 INVALID_ARGUMENT: Wrong request", metadata: { code: "400" } }
        )
      );
  });

  it("responds with 'Not found' in Goodbye", () => {
    return goodbye({})
      .then(() => assert(false, "Shouldn't respond with payload"))
      .catch(({code, message, metadata})=>
        assert.deepEqual(
          { code, message, metadata: { code: metadata.get("code").pop() } },
          { code: 5, message: "5 NOT_FOUND: Not found", metadata: { code: "404" } }
        )
      );
  });

  describe("client stream", () => {
    it("client stream responds with 'Wrong request' on 'how are you'", (done) => {
      let counter = 0;
      const call = client.howAreYou((err, data) => {
        assert(!data, "Shouldn\"t respond with payload");
        const { code, message, metadata } = err;
        assert(counter===0, 'Should be called once');
        assert.deepEqual(
          { code, message, metadata: { code: metadata.get("code").pop() } },
          { code: 3, message: "3 INVALID_ARGUMENT: Wrong request", metadata: { code: "400" } }
        );
        counter++;
        done();
      });
      call.write({ message: "Hi" });
      call.write({ message: "How are you?" });
      call.end();
    });
  });

  describe("server stream", () => {
    it("responds with 'Wrong request' to 'nice to meet you'", (done) => {
      const call = client.niceToMeetYou({ message: "Hi. I'm John. Nice to meet you" });
      call.on("error", ({code, message, metadata}) => {
        assert.deepEqual(
          { code, message, metadata: { code: metadata.get("code").pop() } },
          { code: 3, message: "3 INVALID_ARGUMENT: Wrong request", metadata: { code: "400" } }
        );
        done();
      });
      call.on("data", () => assert("Should't respond with payload"));
      call.on("end", () => assert("Should't end with payload"));
    });
  });

  describe("mutual stream", () => {
    it("responds with 'Wrong request' to 'chat'", (done) => {
      const call = client.chat();
      call.on("error", ({code, message, metadata}) => {
        assert.deepEqual(
          { code, message, metadata: { code: metadata.get("code").pop() } },
          { code: 3, message: "3 INVALID_ARGUMENT: Wrong request", metadata: { code: "400" } }
        );
        done();
      });
      call.on("data", () => assert("Should't respond with payload"));
      call.on("end", () => assert("Should't end with payload"));
      call.write({ message: "Hi" });
      call.write({ message: "How are you?" });
    });
  });

  after(() => {
    mockServer.close(true);
  });
});
