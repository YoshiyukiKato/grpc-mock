const path = require("path");
const assert =require("power-assert");
const {client, hello, goodbye} = require("./fixture/greeter-client");
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
      method: "niceToMeetYou",
      streamType: "server",
      dialogue: [
        { output: { message: "Hi, I'm Sana" } },
        { output: { message: "Nice to meet you too" } },
      ],
      input: { message: "Hi. I'm John. Nice to meet you" }
    },
    
    {
      method: "chat",
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
    it("responds how are you", (done) => {
      const call = client.howAreYou((err, data) => {
        if(err){
          assert(err);
        }else{
          assert.deepEqual(data, { message: "I'm fine, thank you" });
        }
        done();
      });
      call.write({ message: "Hi" });
      call.write({ message: "How are you?" });
      call.end();
    });
  });
  
  describe("server stream", () => {
    it("responds nice to meet you", (done) => {
      const call = client.niceToMeetYou({ message: "Hi. I'm John. Nice to meet you" });
      const memo = [];
      call.on("data", (data) => {
        memo.push(data);
      });
      call.on("end", () => {
        assert.deepEqual(memo, [
          { message: "Hi, I'm Sana" },
          { message: "Nice to meet you too" }
        ]);
        done();
      });
    });
  });
  
  describe("mutual stream", () => {
    it("responds chat", (done) => {
      const call = client.chat();
      const memo = [];
      
      call.on("data", (data) => {
        memo.push(data);
      });

      call.write({ message: "Hi" });
      call.write({ message: "How are you?" });

      call.on("end", () => {
        assert.deepEqual(memo, [
          { message: "Hi dear" },
          { message: "I'm fine, thank you." }
        ]);
        done();
      });
    });
  });

  after((done) => {
    mockServer.close(false, () => {
      done();
    });
  });
});