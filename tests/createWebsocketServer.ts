import { WebSocketServer } from "ws";

export const createWebSocketServer = (server: any) => {
  const wss = new WebSocketServer({ port: 8080 });
  wss.on("connection", function (webSocket) {
    webSocket.on("message", function (message) {
      console.log("connected");
      webSocket.send(message);
    });
  });
};
