using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public static class ReportBuilder
{
    public static ReportV1 Build(AnalysisJob job, IReadOnlyList<Finding> findings, string? aiNarrative)
    {
        var (risk, coverage, summary) = RiskEngine.Evaluate(findings, job.AnalyzerResults);
        var missing = RiskEngine.BuildMissingChecks(job.AnalyzerResults);
        var recommendations = RiskEngine.BuildRecommendations(findings, coverage);

        var categories = new List<ReportCategoryRow>
        {
            Row("Procedencia", findings, FindingCategory.Provenance),
            Row("Integridad", findings, FindingCategory.Integrity),
            Row("Reputación", findings, FindingCategory.Reputation),
            Row("Análisis estático", findings, FindingCategory.Static),
            Row("Actualización", findings, FindingCategory.Update),
        };

        var statements = findings.Select(f => new VerifiedFindingStatement(
            f.Id,
            f.Title)).ToList();

        return new ReportV1(
            SchemaVersion: "1.0",
            AnalysisId: job.Id,
            FileName: job.OriginalFileName,
            Sha256: job.Sha256,
            RiskLevel: risk,
            Coverage: coverage,
            SummaryStatus: summary,
            Categories: categories,
            VerifiedFindings: statements,
            MissingChecks: missing,
            Recommendations: recommendations,
            AiNarrative: aiNarrative);
    }

    private static ReportCategoryRow Row(string label, IReadOnlyList<Finding> findings, FindingCategory cat)
    {
        var inCat = findings.Where(f => f.Category == cat).ToList();
        if (inCat.Count == 0)
            return new ReportCategoryRow(label, "No evaluado o sin hallazgos");

        var worst = inCat.Max(f => f.Severity);
        var text = worst switch
        {
            FindingSeverity.Critical or FindingSeverity.High => "Hay un problema que conviene revisar antes de instalar",
            FindingSeverity.Medium => "Hay señales dudosas; no instales sin comprobar el origen",
            _ => "No vimos nada grave aquí, pero eso no significa que sea seguro"
        };
        return new ReportCategoryRow(label, text);
    }
}
