namespace SafeUpdate.Domain.Models;

public sealed record AnalyzerEnvelope(
    string Analyzer,
    AnalyzerRunStatus Status,
    IReadOnlyList<Finding> Findings,
    IReadOnlyList<string> Errors,
    bool CountsTowardCoverage);
