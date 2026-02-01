// const { app, BrowserWindow, globalShortcut } = require("electron");
// const path = require("path");
// const { spawn } = require("child_process");
// const WebSocket = require("ws");

// let win;
// let recorderProc;
// let pyProc;
// let ws;

// function getResourcePath(...parts) {
//   // dev-friendly (adjust later for packaged apps)
//   return path.join(__dirname, ...parts);
// }

// function startWhisperServer() {
//   if (pyProc) return;

//   const py = path.join(
//     __dirname,
//     "stt_server",
//     ".venv",
//     "Scripts",
//     "python.exe",
//   );
//   const serverPath = path.join(__dirname, "stt_server", "server.py");

//   pyProc = spawn(py, [serverPath], {
//     cwd: path.join(__dirname, "stt_server"), // IMPORTANT
//     stdio: ["ignore", "pipe", "pipe"],
//     windowsHide: true,
//   });

//   pyProc.stdout.on("data", (d) =>
//     console.log("[whisper]", d.toString().trim()),
//   );
//   pyProc.stderr.on("data", (d) =>
//     console.error("[whisper:err]", d.toString().trim()),
//   );

//   pyProc.on("exit", (code) => {
//     console.log("[whisper] exited", code);
//     pyProc = null;
//   });
// }

// function connectWhisperWSWithRetry({ retries = 40, delayMs = 250 } = {}) {
//   return new Promise((resolve, reject) => {
//     let attempt = 0;

//     const tryConnect = () => {
//       attempt++;

//       const sock = new WebSocket("ws://127.0.0.1:8765");

//       sock.once("open", () => {
//         ws = sock;
//         resolve();
//       });

//       sock.once("error", (err) => {
//         sock.close();
//         if (attempt >= retries) {
//           reject(
//             new Error(
//               `Whisper WS not ready after ${retries} tries: ${err.message}`,
//             ),
//           );
//         } else {
//           setTimeout(tryConnect, delayMs);
//         }
//       });

//       sock.on("message", (data) => {
//         try {
//           const msg = JSON.parse(data.toString());
//           if (!win) return;

//           if (msg.type === "partial")
//             win.webContents.send("caption_partial", msg.text || "");
//           if (msg.type === "final")
//             win.webContents.send("caption", msg.text || "");
//         } catch {}
//       });

//       sock.on("close", () => {
//         if (ws === sock) ws = null;
//       });
//     };

//     tryConnect();
//   });
// }

// function startRecorder() {
//   if (recorderProc) return;

//   const exePath = getResourcePath("bin", "loopback_recorder.exe");

//   // Optional: save a debug WAV in userData for verification (comment out if not needed)
//   const outDir = app.getPath("userData");
//   const wavDebug = path.join(outDir, `debug_${Date.now()}.wav`);

//   recorderProc = spawn(exePath, [wavDebug], {
//     stdio: ["pipe", "pipe", "pipe"], // stdin (STOP), stdout (PCM), stderr
//     windowsHide: true,
//   });

//   recorderProc.stderr.on("data", (d) =>
//     console.error("[recorder:err]", d.toString().trim()),
//   );

//   recorderProc.on("exit", (code) => {
//     console.log("[recorder] exited", code);
//     recorderProc = null;
//   });
// }

// async function startCaptionsPipeline() {
//   startWhisperServer();

//   // wait a moment for server to boot
//   // await new Promise((r) => setTimeout(r, 400));
//   // await connectWhisperWS();]
//   // startWhisperServer();
//   await connectWhisperWSWithRetry({ retries: 60, delayMs: 250 }); // ~15s max

//   startRecorder();

//   let bytes = 0;
//   setInterval(() => {
//     console.log("[audio] bytes/sec:", bytes);
//     bytes = 0;
//   }, 1000);

//   // Pipe recorder PCM stdout -> whisper ws
//   recorderProc.stdout.on("data", (chunk) => {
//     if (ws && ws.readyState === WebSocket.OPEN) {
//       ws.send(chunk); // binary
//     }
//   });
// }

// function stopAll() {
//   try {
//     if (ws && ws.readyState === WebSocket.OPEN) ws.close();
//   } catch {}

//   ws = null;

//   if (recorderProc) {
//     try {
//       recorderProc.stdin.write("STOP\n");
//       recorderProc.stdin.end();
//     } catch {}

//     setTimeout(() => {
//       try {
//         recorderProc?.kill();
//       } catch {}
//     }, 1500);
//   }

//   if (pyProc) {
//     setTimeout(() => {
//       try {
//         pyProc?.kill();
//       } catch {}
//     }, 500);
//   }
// }

// function createWindow() {
//   win = new BrowserWindow({
//     width: 520,
//     height: 220,
//     alwaysOnTop: true,
//     resizable: false,
//     frame: true,
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//     },
//   });

//   win.setContentProtection(true);
//   win.loadFile("index.html");

//   startCaptionsPipeline().catch((e) => console.error("Pipeline error:", e));

//   globalShortcut.register("Control+Shift+H", () => {
//     if (!win) return;
//     if (win.isVisible()) win.hide();
//     else win.show();
//   });

//   win.on("closed", () => {
//     stopAll();
//     win = null;
//   });
// }

// app.whenReady().then(createWindow);

// app.on("before-quit", () => {
//   stopAll();
// });

// app.on("will-quit", () => {
//   globalShortcut.unregisterAll();
// });

// const { spawn } = require("child_process");
// const WebSocket = require("ws");

// let ws = null;
// let wsReady = false;

// function connectWhisperWS() {
//   ws = new WebSocket("ws://127.0.0.1:8765");

//   ws.on("open", () => {
//     wsReady = true;
//     console.log("[ws] connected to whisper");
//   });

//   ws.on("close", () => {
//     wsReady = false;
//     console.log("[ws] closed, retrying in 1s...");
//     setTimeout(connectWhisperWS, 1000);
//   });

//   ws.on("error", (err) => {
//     wsReady = false;
//     console.log("[ws] error:", err.message);
//   });

//   ws.on("message", (msg) => {
//     // transcription from python -> send to renderer overlay
//     // mainWindow.webContents.send("caption", msg.toString());
//     console.log("[ws] caption:", msg.toString());
//   });
// }

// connectWhisperWS();

// const rec = spawn("./bin/loopback_recorder.exe", [], {
//   stdio: ["ignore", "pipe", "pipe"],
//   windowsHide: true,
// });

// rec.stderr.on("data", (d) => console.log("[recorder]", d.toString()));
// rec.on("exit", (code) => console.log("recorder exit", code));

// let bytes = 0;
// setInterval(() => {
//   console.log("[audio] bytes/sec:", bytes);
//   bytes = 0;
// }, 1000);

// rec.stdout.on("data", (chunk) => {
//   bytes += chunk.length;

//   // Only send when WS is actually ready
//   if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
//     ws.send(chunk);
//   }
// });

// working

// const path = require("path");
// const { spawn } = require("child_process");
// const WebSocket = require("ws");

// // ---------- Paths ----------
// const ROOT = __dirname;
// const PY_EXE = path.join(ROOT, "stt_server", ".venv", "Scripts", "python.exe");
// const PY_SERVER = path.join(ROOT, "stt_server", "server.py"); // change if different
// const PY_CWD = path.join(ROOT, "stt_server");
// const FRAME_BYTES = 640;

// let pcmBuf = Buffer.alloc(0);
// const REC_EXE = path.join(ROOT, "bin", "loopback_recorder.exe");

// // ---------- Spawn Whisper server ----------
// function startWhisperServer() {
//   const py = spawn(PY_EXE, [PY_SERVER], {
//     cwd: PY_CWD,
//     stdio: ["ignore", "pipe", "pipe"],
//     windowsHide: true,
//   });

//   // py.stdout.on("data", (d) => console.log("[whisper]", d.toString().trimEnd()));
//   py.stderr.on("data", (d) =>
//     console.log("[whisper:err]", d.toString().trimEnd()),
//   );

//   py.on("exit", (code) => {
//     console.log("[whisper] exited with code", code, "restarting in 1s...");
//     setTimeout(startWhisperServer, 1000);
//   });

//   return py;
// }

// startWhisperServer();

// // ---------- Connect to Whisper WS ----------
// let ws = null;
// let wsReady = false;

// function connectWhisperWS() {
//   ws = new WebSocket("ws://127.0.0.1:8765");

//   ws.on("open", () => {
//     wsReady = true;
//     // console.log("[ws] connected to whisper");
//   });

//   ws.on("close", () => {
//     wsReady = false;
//     // console.log("[ws] closed, retrying in 1s...");
//     setTimeout(connectWhisperWS, 1000);
//   });

//   ws.on("error", (err) => {
//     wsReady = false;
//     // console.log("[ws] error:", err.message);
//     // close triggers retry path too
//     try {
//       ws.close();
//     } catch {}
//   });

//   ws.on("message", (msg) => {
//     try {
//       const data = JSON.parse(msg.toString());
//       if (data.type === "final" && data.text && data.text.trim()) {
//         console.log(data.text.trim());
//       }
//     } catch {
//       // ignore non-JSON
//     }
//   });
// }

// connectWhisperWS();

// // ---------- Spawn recorder ----------
// const rec = spawn(REC_EXE, [], {
//   stdio: ["ignore", "pipe", "pipe"],
//   windowsHide: true,
// });

// rec.stderr.on("data", (d) => console.log("[recorder]", d.toString().trimEnd()));
// rec.on("exit", (code) => console.log("[recorder] exit", code));

// // bytes/sec counter in Electron
// let bytes = 0;
// // setInterval(() => {
// //   console.log("[audio] bytes/sec:", bytes);
// //   bytes = 0;
// // }, 1000);

// // Forward PCM to whisper websocket
// // rec.stdout.on("data", (chunk) => {
// //   bytes += chunk.length;

// //   if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
// //     ws.send(chunk);
// //   }
// // });

// rec.stdout.on("data", (chunk) => {
//   bytes += chunk.length;

//   pcmBuf = Buffer.concat([pcmBuf, chunk]);

//   while (pcmBuf.length >= FRAME_BYTES) {
//     const frame = pcmBuf.subarray(0, FRAME_BYTES);
//     pcmBuf = pcmBuf.subarray(FRAME_BYTES);

//     if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
//       ws.send(frame);
//     }
//   }
// });

// new

// const { app, BrowserWindow, globalShortcut } = require("electron");
// const path = require("path");
// const { spawn } = require("child_process");
// const WebSocket = require("ws");

// let win = null;
// let py = null;
// let rec = null;

// let ws = null;
// let wsReady = false;

// // ---- audio framing (20ms) ----
// const FRAME_BYTES = 640;
// let pcmBuf = Buffer.alloc(0);

// // ---- paths (adjust if needed) ----
// const ROOT = __dirname;
// const PY_EXE = path.join(ROOT, "stt_server", ".venv", "Scripts", "python.exe");
// const PY_SERVER = path.join(ROOT, "stt_server", "server.py");
// const PY_CWD = path.join(ROOT, "stt_server");
// const REC_EXE = path.join(ROOT, "bin", "loopback_recorder.exe");

// // ------------ Window ------------
// function createWindow() {
//   win = new BrowserWindow({
//     width: 800,
//     height: 320,
//     alwaysOnTop: true,
//     resizable: false,
//     frame: true,
//     transparent: false,
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//       contextIsolation: true,
//     },
//   });

//   // Invisible to screen share / capture tools that respect Windows content protection
//   win.setContentProtection(true);

//   win.loadFile("index.html");

//   startCaptionsPipeline().catch((e) => console.error("Pipeline error:", e));

//   globalShortcut.register("Control+Shift+H", () => {
//     if (!win) return;
//     win.isVisible() ? win.hide() : win.show();
//   });

//   win.on("closed", () => {
//     stopAll();
//     win = null;
//   });
// }

// app.whenReady().then(createWindow);

// app.on("window-all-closed", () => {
//   stopAll();
//   if (process.platform !== "darwin") app.quit();
// });

// // ------------ Pipeline ------------
// function startWhisperServer() {
//   if (py) return;

//   py = spawn(PY_EXE, [PY_SERVER], {
//     cwd: PY_CWD,
//     stdio: ["ignore", "ignore", "ignore"], // quiet
//     windowsHide: true,
//   });

//   py.on("exit", () => {
//     py = null;
//     // optional: restart automatically
//     setTimeout(() => startWhisperServer(), 500);
//   });
// }

// function connectWhisperWS() {
//   return new Promise((resolve) => {
//     const tryConnect = () => {
//       ws = new WebSocket("ws://127.0.0.1:8765");

//       ws.on("open", () => {
//         wsReady = true;
//         resolve();
//       });

//       ws.on("close", () => {
//         wsReady = false;
//         // keep trying
//         setTimeout(tryConnect, 300);
//       });

//       ws.on("error", () => {
//         wsReady = false;
//         try {
//           ws.close();
//         } catch {}
//       });

//       ws.on("message", (msg) => {
//         // server sends JSON: {type:"final", text:"...", decode_ms:...}
//         try {
//           const data = JSON.parse(msg.toString());
//           if (data.type === "final" && data.text && data.text.trim()) {
//             // Send caption to renderer
//             if (win && !win.isDestroyed()) {
//               win.webContents.send("caption", data.text.trim());
//             }
//           }
//         } catch {
//           // ignore
//         }
//       });
//     };

//     tryConnect();
//   });
// }

// function startRecorder() {
//   if (rec) return;

//   rec = spawn(REC_EXE, [], {
//     stdio: ["ignore", "pipe", "ignore"], // quiet
//     windowsHide: true,
//   });

//   rec.on("exit", () => {
//     rec = null;
//   });

//   rec.stdout.on("data", (chunk) => {
//     // frame into 20ms packets (640 bytes)
//     pcmBuf = Buffer.concat([pcmBuf, chunk]);

//     while (pcmBuf.length >= FRAME_BYTES) {
//       const frame = pcmBuf.subarray(0, FRAME_BYTES);
//       pcmBuf = pcmBuf.subarray(FRAME_BYTES);

//       if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
//         ws.send(frame);
//       }
//     }
//   });
// }

// async function startCaptionsPipeline() {
//   startWhisperServer();
//   await connectWhisperWS();
//   startRecorder();
// }

// function stopAll() {
//   try {
//     ws?.close();
//   } catch {}
//   ws = null;
//   wsReady = false;

//   try {
//     rec?.kill();
//   } catch {}
//   rec = null;

//   try {
//     py?.kill();
//   } catch {}
//   py = null;
// }

const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");

const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

let win = null;
let py = null;
let rec = null;

let ws = null;
let wsReady = false;

// ---- audio framing (20ms) ----
const FRAME_BYTES = 640;
let pcmBuf = Buffer.alloc(0);

// ---- paths (adjust if needed) ----
const ROOT = __dirname;
const PY_EXE = path.join(ROOT, "stt_server", ".venv", "Scripts", "python.exe");
const PY_SERVER = path.join(ROOT, "stt_server", "server.py");
const PY_CWD = path.join(ROOT, "stt_server");
const REC_EXE = path.join(ROOT, "bin", "loopback_recorder.exe");

const SYSTEM_CONTEXT = `
You are an interview copilot.

We are attending a technical interview focused on React.js.

Your job is to generate the exact answers I should speak in the interview.
Be concise, precise, and technically correct.

Assume the interviewer is asking React.js questions.
If the question contains spelling mistakes, incomplete sentences, or informal phrasing, infer the intended meaning and answer correctly.

Do NOT:
- add explanations beyond what is required
- give multiple alternative answers
- include opinions, disclaimers, or extra commentary
- ask follow-up questions

DO:
- give the most correct and commonly accepted React.js answer
- use short, clear sentences or bullet points when appropriate
- answer only what is asked, nothing more and nothing else
`;

// ---- OpenAI streaming ----
let OpenAIClient = null;

// Keep lightweight history (optional)
const chatHistory = []; // [{q, a}]
const MAX_HISTORY_TURNS = 2;

// Track active LLM streams so you can cancel later if you want
const activeStreams = new Map(); // blockId -> { cancelled: boolean }

async function getOpenAI() {
  if (OpenAIClient) return OpenAIClient;

  // openai-node is ESM; dynamic import works from CommonJS
  const { default: OpenAI } = await import("openai");
  OpenAIClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return OpenAIClient;
}

// ------------ Window ------------
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 520,
    alwaysOnTop: true,
    resizable: true,
    frame: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  async function warmupLLM() {
    if (!process.env.OPENAI_API_KEY) return;
    try {
      const client = await getOpenAI();
      await client.responses.create({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: "hi" }],
        max_output_tokens: 1,
      });
    } catch {}
  }

  // Invisible to screen share / capture tools that respect Windows content protection
  win.setContentProtection(true);

  win.loadFile("index.html");
  warmupLLM();

  startCaptionsPipeline().catch((e) => console.error("Pipeline error:", e));

  globalShortcut.register("Control+Shift+H", () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });

  win.on("closed", () => {
    stopAll();
    win = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopAll();
  if (process.platform !== "darwin") app.quit();
});

// ------------ IPC: Ask LLM ------------
ipcMain.handle("llm:ask", async (_evt, payload) => {
  // payload: { blockId, question, mode }
  // mode can be "ask" or "followup" (you can treat them differently if you want)

  const { blockId, question } = payload || {};
  if (!blockId || !question || !String(question).trim()) {
    return { ok: false, error: "Missing blockId/question" };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY is not set" };
  }

  // mark stream active
  activeStreams.set(blockId, { cancelled: false });

  // fire-and-forget streaming (renderer listens to llm:* events)
  streamAnswerToRenderer(blockId, String(question).trim()).catch((err) => {
    try {
      win?.webContents?.send("llm:error", {
        blockId,
        message: err?.message || String(err),
      });
    } catch {}
    activeStreams.delete(blockId);
  });

  return { ok: true };
});

// Optional: cancel
ipcMain.handle("llm:cancel", async (_evt, { blockId }) => {
  const s = activeStreams.get(blockId);
  if (s) s.cancelled = true;
  return { ok: true };
});

async function streamAnswerToRenderer(blockId, question) {
  const client = await getOpenAI();

  // Build a small context window (optional)
  const historyText = chatHistory
    .slice(-MAX_HISTORY_TURNS)
    .map((t, i) => `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a}`)
    .join("\n\n");

  // const prompt =
  //   (historyText ? `Conversation so far:\n${historyText}\n\n` : "") +
  //   `Answer the user's question clearly and directly.\n\nUser question:\n${question}`;

  const prompt =
    `${SYSTEM_CONTEXT.trim()}\n\n` +
    (historyText ? `Conversation so far:\n${historyText}\n\n` : "") +
    `User question:\n${question}`;

  let full = "";

  // Stream using Responses API semantics :contentReference[oaicite:2]{index=2}
  const stream = await client.responses.create({
    model: "gpt-4o-mini", // fastest/cheapest for low-latency; swap to your preferred model
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: true,
  });

  try {
    for await (const event of stream) {
      const state = activeStreams.get(blockId);
      if (!state || state.cancelled) {
        break;
      }

      // event types described in the streaming docs :contentReference[oaicite:3]{index=3}
      if (event.type === "response.output_text.delta") {
        const delta = event.delta || "";
        if (delta) {
          full += delta;
          win?.webContents?.send("llm:delta", { blockId, delta });
        }
      }

      if (event.type === "response.completed") {
        break;
      }
    }
  } finally {
    activeStreams.delete(blockId);
  }

  // store history (optional)
  chatHistory.push({ q: question, a: full.trim() });
  if (chatHistory.length > MAX_HISTORY_TURNS) {
    chatHistory.splice(0, chatHistory.length - MAX_HISTORY_TURNS);
  }

  win?.webContents?.send("llm:done", { blockId, answer: full.trim() });
}

// ------------ Pipeline ------------
function startWhisperServer() {
  if (py) return;

  py = spawn(PY_EXE, [PY_SERVER], {
    cwd: PY_CWD,
    stdio: ["ignore", "ignore", "ignore"], // quiet
    windowsHide: true,
  });

  py.on("exit", () => {
    py = null;
    setTimeout(() => startWhisperServer(), 500);
  });
}

function connectWhisperWS() {
  return new Promise((resolve) => {
    const tryConnect = () => {
      ws = new WebSocket("ws://127.0.0.1:8765");

      ws.on("open", () => {
        wsReady = true;
        resolve();
      });

      ws.on("close", () => {
        wsReady = false;
        setTimeout(tryConnect, 300);
      });

      ws.on("error", () => {
        wsReady = false;
        try {
          ws.close();
        } catch {}
      });

      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === "final" && data.text && data.text.trim()) {
            if (win && !win.isDestroyed()) {
              win.webContents.send("caption", data.text.trim());
            }
          }
        } catch {}
      });
    };

    tryConnect();
  });
}

function startRecorder() {
  if (rec) return;

  rec = spawn(REC_EXE, [], {
    stdio: ["ignore", "pipe", "ignore"], // quiet
    windowsHide: true,
  });

  rec.on("exit", () => {
    rec = null;
  });

  rec.stdout.on("data", (chunk) => {
    pcmBuf = Buffer.concat([pcmBuf, chunk]);

    while (pcmBuf.length >= FRAME_BYTES) {
      const frame = pcmBuf.subarray(0, FRAME_BYTES);
      pcmBuf = pcmBuf.subarray(FRAME_BYTES);

      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    }
  });
}

async function startCaptionsPipeline() {
  startWhisperServer();
  await connectWhisperWS();
  startRecorder();
}

function stopAll() {
  try {
    ws?.close();
  } catch {}
  ws = null;
  wsReady = false;

  try {
    rec?.kill();
  } catch {}
  rec = null;

  try {
    py?.kill();
  } catch {}
  py = null;

  activeStreams.clear();
}
