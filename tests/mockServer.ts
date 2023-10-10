import { Server } from "mock-socket";
import { Picfinder } from "../Picfinder";
import { delay } from "../Picfinder/utils";

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
