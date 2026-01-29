const { app, BrowserWindow, globalShortcut } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let win;
let recorderProc;

function startRecorder() {
  if (recorderProc) return;

  const exePath = path.join(__dirname, "bin", "loopback_recorder.exe");

  // Save recordings in Electron's userData folder
  const outDir = app.getPath("userData");
  const outFile = path.join(outDir, `meeting_${Date.now()}.wav`);

  recorderProc = spawn(exePath, [outFile], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  recorderProc.stdout.on("data", (d) =>
    console.log("[recorder]", d.toString().trim()),
  );
  recorderProc.stderr.on("data", (d) =>
    console.error("[recorder:err]", d.toString().trim()),
  );

  recorderProc.on("exit", (code, signal) => {
    console.log(`[recorder] exited code=${code} signal=${signal}`);
    recorderProc = null;
  });

  console.log("Recorder started ->", outFile);
}

function stopRecorder() {
  if (!recorderProc) return;

  try {
    // graceful stop
    recorderProc.stdin.write("STOP\n");
    recorderProc.stdin.end();
  } catch {}

  // fallback kill if it hangs
  setTimeout(() => {
    if (recorderProc) {
      try {
        recorderProc.kill();
      } catch {}
    }
  }, 2000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 360,
    height: 240,
    alwaysOnTop: true,
    resizable: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setContentProtection(true);
  win.loadFile("index.html");

  // Start recording when window is ready (or immediately)
  startRecorder();

  // Stop recording when window is closing
  win.on("closed", () => {
    stopRecorder();
    win = null;
  });

  globalShortcut.register("Control+Shift+H", () => {
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  stopRecorder();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
