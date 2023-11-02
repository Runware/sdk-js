// import {
//   afterAll,
//   afterEach,
//   beforeAll,
//   beforeEach,
//   describe,
//   expect,
//   test,
//   vi,
// } from "vitest";
// import {
//   startHttpServer,
//   startMockBackendServer,
//   startMockServer,
// } from "../mockServer";
// import { getTaskType } from "../../Picfinder/utils";
// import { PicfinderServer } from "../../Picfinder";

// const PORT = 8080;

// vi.mock("../../Picfinder/utils", async () => {
//   const actual = await vi.importActual("../../Picfinder/utils");
//   return {
//     ...(actual as any),
//     fileToBase64: vi.fn().mockReturnValue("FILE_TO_BASE_64"),
//     getIntervalWithPromise: vi.fn(),
//     getUUID: vi.fn().mockImplementation(() => "UNIQUE_UID"),
//   };
// });

// describe("When using backend mockServer", async () => {
//   // let server: any;
//   // let picfinderServer: any;

//   const { picfinderServer } = await startMockBackendServer();

//   beforeAll(async () => {
//     // const { ps } = await startHttpServer(PORT);
//     // console.log({ server, ws });
//     // console.log({ server });
//     // const { picfinderServer: ps } = await startMockBackendServer();
//     // console.log({ ps });
//     // picfinderServer = ps;
//   });

//   // const { mockServer, picfinder } = await startMockServer();

//   afterEach(() => {
//     vi.clearAllMocks();
//   });

//   beforeEach(() => {
//     // mockServer.stop();
//   });

//   // afterAll(() => server?.close());

//   test("it should request image without an image initiator", async () => {
//     const connectMethod = vi.spyOn(picfinderServer as any, "connect");
//     expect(connectMethod).toBeCalledTimes(1);
//   });
// });
