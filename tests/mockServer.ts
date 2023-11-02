import { Server } from "mock-socket";
import { Picfinder, PicfinderServer } from "../Picfinder";
import { delay } from "../Picfinder/utils";
import { WebSocketServer } from "ws";

export const startMockServer = async () => {
  const mockServer = new Server("ws://localhost:8080");

  mockServer.on("connection", (socket) => {
    socket.on("message", (data) => {
      //   socket.send("test message from mock server");
    });
  });

  const picfinder = new Picfinder("TEST", "API_KEY");
  await delay(1);

  return { picfinder, mockServer };
};

export const startMockBackendServer = async () => {
  const mockServer = new WebSocketServer({ port: 8080 });

  mockServer.on("connection", (socket) => {
    socket.on("message", (data, isBinary) => {
      const message = !isBinary ? data?.toString() : data;
      //   socket.send("test message from mock server");
    });
  });

  const picfinderServer = new PicfinderServer("TEST", "API_KEY");
  await delay(1);

  return { picfinderServer, mockServer };
};
