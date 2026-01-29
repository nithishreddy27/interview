using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.CoreAudioApi;
using NAudio.Wave;

internal static class Program
{
    static async Task<int> Main(string[] args)
    {
        string outputPath = (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
            ? args[0]
            : Path.Combine(AppContext.BaseDirectory, $"loopback_{DateTime.Now:yyyyMMdd_HHmmss}.wav");

        using var device = GetDefaultRenderDevice();
        using var capture = new WasapiLoopbackCapture(device);

        // This completes only when WASAPI actually stops and fires RecordingStopped
        var stoppedTcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);

        using var writer = new WaveFileWriter(outputPath, capture.WaveFormat);

        capture.DataAvailable += (_, e) =>
        {
            // If you want to verify it's recording, uncomment:
            // Console.WriteLine($"bytes={e.BytesRecorded}");
            writer.Write(e.Buffer, 0, e.BytesRecorded);
        };

        capture.RecordingStopped += (_, e) =>
        {
            try
            {
                writer.Flush();
            }
            finally
            {
                if (e.Exception != null)
                    Console.Error.WriteLine(e.Exception);

                stoppedTcs.TrySetResult(null);
            }
        };

        Console.WriteLine($"RECORDING: {device.FriendlyName}");
        Console.WriteLine($"OUTPUT: {outputPath}");
        Console.Out.Flush();

        capture.StartRecording();

        // Wait until Electron tells us STOP (or stdin closes)
        await WaitForStopAsync();

        // Request stop
        capture.StopRecording();

        // IMPORTANT: wait for RecordingStopped so WAV header is finalized
        await stoppedTcs.Task;

        Console.WriteLine("STOPPED");
        Console.Out.Flush();
        return 0;
    }

    private static MMDevice GetDefaultRenderDevice()
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
    }

    private static async Task WaitForStopAsync()
    {
        try
        {
            while (true)
            {
                var line = await Console.In.ReadLineAsync();
                if (line == null) return; // parent closed stdin
                if (line.Trim().Equals("STOP", StringComparison.OrdinalIgnoreCase)) return;
            }
        }
        catch
        {
            // If stdin isn't available, just keep running until killed.
            // (Electron should still be able to kill the process)
            await Task.Delay(Timeout.InfiniteTimeSpan);
        }
    }
}
