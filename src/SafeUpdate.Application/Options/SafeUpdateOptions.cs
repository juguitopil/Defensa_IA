namespace SafeUpdate.Application.Options;

public sealed class SafeUpdateOptions
{
    public const string SectionName = "SafeUpdate";

    public long MaxUploadBytes { get; set; } = 32 * 1024 * 1024;
    public int MaxFileNameLength { get; set; } = 200;
    public string UploadRoot { get; set; } = "data/uploads";
    public int UploadRetentionHours { get; set; } = 24;
    public string? ApiKey { get; set; }
    public int AnalysisTimeoutSeconds { get; set; } = 120;
    public bool AllowUrlDownload { get; set; } = true;
    public int MaxUrlRedirects { get; set; } = 3;
}
