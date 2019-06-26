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
    { method: "hello", input: { message: "test" }, output: { message: "Hello" } },
    { method: "hello", input: { message: "Hi" }, output: { message: "Back at you" } },
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
      method: "howAreYou",
      streamType: "client",
      stream: [
        { input: { message: "Hello" } },
        { input: { message: "How is the weather?" } },
      ],
      output: { message: "Looks like it might rain" }
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
      method: "niceToMeetYou",
      streamType: "server",
      stream: [
        { output: { message: "Hi, I'm Sana" } },
        { output: { message: "Have you met John?" } },
      ],
      input: { message: "Hi. I'm Frank. Nice to meet you" }
    },
    {
      method: "chat",
      streamType: "mutual",
      stream: [
        { input: { message: "Hi" }, output: { message: "Hi there" } },
        { input: { message: "How are you?" }, output: { message: "I'm fine, thank you." } },
      ]
    },
    {
      method: "chat",
      streamType: "mutual",
      stream: [
        { input: { message: "Hello" }, output: { message: "G'day" } },
        { input: { message: "Do you think it will rain?" }, output: { message: "No, the sky looks clear" } },
      ]
    }
  ]
});

describe("grpc-mock", () => {
  before((done) => {
    mockServer.listen("0.0.0.0:50051");
    done();
  });

  afterEach(() => mockServer.clearInteractions());

  it("responds Hello", () => {
    return hello({ message : "test" })
      .then((res) => {
        assert(res.message === "Hello");
      })
      .catch(assert);
  });

  it("responds Back at you", () => {
    return hello({ message : "Hi" })
      .then((res) => {
        assert(res.message === "Back at you");
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

  it("throws unexpected input pattern error", () => {
    return hello({ message : "unexpected" })
      .then((res) => {
        assert.fail("unexpected success with response:", res);
      })
      .catch((err) => {
        assert(err.code, 3);
        assert(err.details, "unexpected input pattern");
      });
  });

  it("records the interactions", () => {
    return hello({ message : "test" })
      .then((res) => {
        assert.deepEqual(mockServer.getInteractionsOn("hello"), [ { message: "test" } ]);
      });
  });

  it("records the interactions when there are no valid responses", (done) => {
    hello({ message : "test1" }).catch(e => {});

    setTimeout(() => {
      assert.deepEqual(mockServer.getInteractionsOn("hello"), [ { message: "test1" } ]);
      done();
    }, 20);
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

    it("responds it is raining", (done) => {
      const call = client.howAreYou((err, data) => {
        if(err){
          assert(err);
        }else{
          assert.deepEqual(data, { message: "Looks like it might rain" });
        }
        done();
      });
      call.write({ message: "Hello" });
      call.write({ message: "How is the weather?" });
      call.end();
    });

    it("throws unexpected input pattern error", (done) => {
      const call = client.howAreYou((err, data) => {
        if(err){
          assert(err.code, 3);
          assert(err.details, "unexpected input pattern");
        }else{
          assert.fail("unexpected success with response:", data);
        }
        done();
      });
      call.write({ message: "Hi" });
      call.write({ message: "unexpected" });
      call.end();
    });

    it("records the interactions when there are valid responses", (done) => {
        const call = client.howAreYou((err, data) => {
          if(err){
            assert(err);
          }else{
            assert.deepEqual(mockServer.getInteractionsOn("howAreYou"), [
               { message: "Hi" },
               { message: "How are you?" },
             ]);
          }
          done();
        });
        call.write({ message: "Hi" });
        call.write({ message: "How are you?" });
        call.end();
    });

    it("records the interactions when there are no valid responses", (done) => {
        const call = client.howAreYou((err, data) => {});
        call.write({ message: "Hi" });
        call.write({ message: "Unexpected message" });
        call.write({ message: "How are you?" });
        call.end();

        setTimeout(() => {
          assert.deepEqual(mockServer.getInteractionsOn("howAreYou"), [
             { message: "Hi" },
             { message: "Unexpected message" }
           ]);
          done();
        }, 20);

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

    it("responds have you met john", (done) => {
      const call = client.niceToMeetYou({ message: "Hi. I'm Frank. Nice to meet you" });
      const memo = [];
      call.on("data", (data) => {
        memo.push(data);
      });
      call.on("end", () => {
        assert.deepEqual(memo, [
          { message: "Hi, I'm Sana" },
          { message: "Have you met John?" }
        ]);
        done();
      });
    });

    it("throws unexpected input pattern error", (done) => {
      const call = client.niceToMeetYou({ message: "unexpected" });
      call.on("data", (data) => {
        assert.fail("unexpected success with response:", data);
        done();
      });
      call.on("error", (err) => {
        assert(err.code, 3);
        assert(err.details, "unexpected input pattern");
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
      call.on("end", () => {
        assert.deepEqual(memo, [
          { message: "Hi there" },
          { message: "I'm fine, thank you." }
        ]);
        done();
      });
      call.write({ message: "Hi" });
      call.write({ message: "How are you?" });
    });

    it("responds weather", (done) => {
      const call = client.chat();
      const memo = [];
      call.on("data", (data) => {
        memo.push(data);
      });
      call.on("end", () => {
        assert.deepEqual(memo, [
          { message: "G'day" },
          { message: "No, the sky looks clear" }
        ]);
        done();
      });
      call.write({ message: "Hello" });
      call.write({ message: "Do you think it will rain?" });
    });

    it("throws unexpected input pattern error", (done) => {
      const call = client.chat();
      call.on("data", (data) => {
        assert.fail("unexpected success with response:", data);
        done();
      });
      call.on("error", (err) => {
        assert(err.code, 3);
        assert(err.details, "unexpected input pattern");
        done();
      });
      call.write({ message: "Unexpected" });
    });
  });

  after(() => {
    mockServer.close(true);
  });
});
