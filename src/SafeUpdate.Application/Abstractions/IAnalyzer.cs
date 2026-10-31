using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Abstractions;

public sealed record AnalysisContext(
    Guid JobId,
    AnalysisSubjectKind SubjectKind,
    string PrimaryFilePath,
    string OriginalFileName,
    string? BaselineFilePath,
    string? SourceUrl,
    string? ExpectedProduct,
    string? InstalledVersion,
    string? OfferedVersion)
{
    public string FilePath => PrimaryFilePath;
}

public interface IAnalyzer
{
    string Name { get; }
    bool CanAnalyze(AnalysisContext context);
    Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken);
}
