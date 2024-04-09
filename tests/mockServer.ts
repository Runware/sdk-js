import { Server } from "mock-socket";
import { Runware, RunwareServer } from "../Runware";
import { BASE_RUNWARE_URLS, delay } from "../Runware/utils";
import { WebSocketServer } from "ws";

export const startMockServer = async () => {
  const mockServer = new Server("ws://localhost:8080");

  mockServer.on("connection", (socket) => {
    socket.on("message", (data) => {
      //   socket.send("test message from mock server");
    });
  });

  const runware = new Runware({
    apiKey: "API_KEY",
    url: BASE_RUNWARE_URLS.TEST,
  });
  await delay(1);

  return { runware, mockServer };
};

export const startMockBackendServer = async () => {
  const mockServer = new WebSocketServer({ port: 8080 });

  mockServer.on("connection", (socket) => {
    socket.on("message", (data, isBinary) => {
      const message = !isBinary ? data?.toString() : data;
      //   socket.send("test message from mock server");
    });
  });

  const runwareServer = new RunwareServer({
    apiKey: "API_KEY",
    url: BASE_RUNWARE_URLS.TEST,
  });
  await delay(1);

  return { runwareServer, mockServer };
};
