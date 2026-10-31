namespace SafeUpdate.Domain.Models;

public sealed record ReportV1(
    string SchemaVersion,
    Guid AnalysisId,
    string FileName,
    string Sha256,
    RiskLevel RiskLevel,
    AnalysisCoverage Coverage,
    string SummaryStatus,
    IReadOnlyList<ReportCategoryRow> Categories,
    IReadOnlyList<VerifiedFindingStatement> VerifiedFindings,
    IReadOnlyList<string> MissingChecks,
    IReadOnlyList<string> Recommendations,
    string? AiNarrative);

public sealed record ReportCategoryRow(string Category, string Result);

public sealed record VerifiedFindingStatement(string FindingId, string Statement);
