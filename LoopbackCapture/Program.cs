using System;
using System.Diagnostics;
using System.Threading;
using NAudio.CoreAudioApi;
using NAudio.MediaFoundation;
using NAudio.Wave;

namespace LoopbackToPcm16k
{
    internal class Program
    {
        static int Main(string[] args)
        {

            bool LOG = false;

            // Start Media Foundation (needed for MediaFoundationResampler)
            MediaFoundationApi.Startup();

            MMDevice device;
            try
            {
                var enumerator = new MMDeviceEnumerator();
                // Use default system output device (loopback)
                device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
                // If you prefer "communications" device:
                // device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Communications);
            }
            catch (Exception ex)
            {
               if (LOG)  Console.Error.WriteLine($"[recorder:err] Failed to get default render device: {ex}");
                return 1;
            }

           if (LOG)  Console.Error.WriteLine($"[recorder] Using loopback device: {device.FriendlyName}");

            using var capture = new WasapiLoopbackCapture(device);
            if (LOG)  Console.Error.WriteLine($"[recorder] Capture format: {capture.WaveFormat}");

            var buffered = new BufferedWaveProvider(capture.WaveFormat)
            {
                DiscardOnBufferOverflow = true,
                BufferDuration = TimeSpan.FromSeconds(2)
            };

            // Output: 16kHz, mono, PCM16
            var outFormat = new WaveFormat(16000, 16, 1);

            using var resampler = new MediaFoundationResampler(buffered, outFormat)
            {
                ResamplerQuality = 60
            };

            using var stdout =  Console.OpenStandardOutput(); // do NOT set WriteTimeout on Windows

            // Stats
            long bytesThisSecond = 0;
            var sw = Stopwatch.StartNew();
            var lastReport = TimeSpan.Zero;

            double sumSquares = 0;
            int sampleCount = 0;
            short peak = 0;

            capture.DataAvailable += (_, e) =>
            {
                // Push captured audio into buffer
                buffered.AddSamples(e.Buffer, 0, e.BytesRecorded);
            };

            capture.RecordingStopped += (_, e) =>
            {
                if (e.Exception != null)
                    if (LOG)  Console.Error.WriteLine($"[recorder:err] Recording stopped due to error: {e.Exception}");
                else
                    if (LOG)  Console.Error.WriteLine("[recorder] Recording stopped.");
            };

            // Reader thread: produce EXACTLY 20ms frames (640 bytes) at real-time pace
            var readerThread = new Thread(() =>
            {
                const int frameBytes = 640; // 20ms @ 16kHz mono PCM16 = 16000*0.02*2 = 640
                var frame = new byte[frameBytes];

                long frameIndex = 0;
                var pace = Stopwatch.StartNew();

                while (true)
                {
                    // Read exactly one frame
                    int got = 0;
                    while (got < frameBytes)
                    {
                        int n;
                        try
                        {
                            n = resampler.Read(frame, got, frameBytes - got);
                        }
                        catch (Exception ex)
                        {
                            if (LOG)  Console.Error.WriteLine($"[recorder:err] Resampler read failed: {ex}");
                            Environment.Exit(2);
                            return;
                        }

                        if (n == 0)
                        {
                            Thread.Sleep(1);
                            continue;
                        }

                        got += n;
                    }

                    // Validate output PCM16 (peak/rms)
                    for (int i = 0; i < frameBytes; i += 2)
                    {
                        short s = (short)(frame[i] | (frame[i + 1] << 8));
                        short abs = (short)Math.Abs(s);
                        if (abs > peak) peak = abs;

                        sumSquares += (double)s * s;
                        sampleCount++;
                    }

                    // Write to stdout (pipe to Electron)
                    try
                    {
                        stdout.Write(frame, 0, frameBytes);
                    }
                    catch
                    {
                        if (LOG)  Console.Error.WriteLine("[recorder] stdout closed, exiting.");
                        Environment.Exit(0);
                        return;
                    }

                    bytesThisSecond += frameBytes;

                    // Pace to 20ms
                    frameIndex++;
                    long targetMs = frameIndex * 20;
                    while (pace.ElapsedMilliseconds < targetMs)
                        Thread.Sleep(1);

                    var elapsed = sw.Elapsed;
                    if (elapsed - lastReport >= TimeSpan.FromSeconds(1))
                    {
                        double rms = sampleCount > 0 ? Math.Sqrt(sumSquares / sampleCount) : 0;
                        if (LOG)  Console.Error.WriteLine($"[audio] bytes/sec: {bytesThisSecond} | peak:{peak} | rms:{rms:F0}");

                        bytesThisSecond = 0;
                        peak = 0;
                        sumSquares = 0;
                        sampleCount = 0;
                        lastReport = elapsed;
                    }
                }
            })
            { IsBackground = true };

            try
            {
                capture.StartRecording();
                readerThread.Start();
                if (LOG)  Console.Error.WriteLine("[recorder] Capture started.");
            }
            catch (Exception ex)
            {
                if (LOG)  Console.Error.WriteLine($"[recorder:err] Failed to start recording: {ex}");
                return 3;
            }

            // Keep alive until killed by parent
            Thread.Sleep(Timeout.Infinite);
            return 0;
        }
    }
}
