namespace SafeUpdate.Domain.Models;

public sealed class AnalysisJob
{
    public Guid Id { get; init; }
    public string? TenantId { get; init; }
    public string? UserId { get; init; }
    public AnalysisSubjectKind SubjectKind { get; init; } = AnalysisSubjectKind.File;
    public AnalysisStatus Status { get; set; } = AnalysisStatus.Queued;
    public string OriginalFileName { get; set; } = "";
    public string StoredFileName { get; set; } = "";
    public string? BaselineStoredFileName { get; init; }
    public string? SourceUrl { get; init; }
    public long FileSizeBytes { get; set; }
    public string Sha256 { get; set; } = "";
    public string? ExpectedProduct { get; init; }
    public string? InstalledVersion { get; init; }
    public string? OfferedVersion { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public List<AnalyzerEnvelope> AnalyzerResults { get; } = [];
    public ReportV1? Report { get; set; }
    public string? FailureReason { get; set; }
}
