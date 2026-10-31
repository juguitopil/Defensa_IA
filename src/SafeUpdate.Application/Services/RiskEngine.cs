using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public static class RiskEngine
{
    public static (RiskLevel Risk, AnalysisCoverage Coverage, string SummaryStatus) Evaluate(
        IReadOnlyList<Finding> findings,
        IReadOnlyList<AnalyzerEnvelope> envelopes)
    {
        var expectedAnalyzers = new[]
        {
            "file_intake", "hash_service", "static_analyzer", "multi_engine_scan",
            "reputation_service", "provenance_checker"
        };
        var completed = envelopes
            .Where(e => e.CountsTowardCoverage && e.Status == AnalyzerRunStatus.Completed)
            .Select(e => e.Analyzer)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var failed = envelopes.Count(e => e.CountsTowardCoverage && e.Status == AnalyzerRunStatus.Failed);
        var missing = expectedAnalyzers.Where(a => !completed.Contains(a)).ToList();

        AnalysisCoverage coverage;
        if (failed > 0 || missing.Count >= 3)
            coverage = AnalysisCoverage.Insufficient;
        else if (missing.Count > 0)
            coverage = AnalysisCoverage.Partial;
        else
            coverage = AnalysisCoverage.Complete;

        var maxSeverity = findings.Count == 0
            ? FindingSeverity.Info
            : findings.Max(f => f.Severity);

        var hasHigh = findings.Any(f => f.Severity is FindingSeverity.High or FindingSeverity.Critical);
        var hasMedium = findings.Any(f => f.Severity == FindingSeverity.Medium);

        RiskLevel risk;
        if (coverage == AnalysisCoverage.Insufficient)
            risk = RiskLevel.Indeterminate;
        else if (hasHigh)
            risk = RiskLevel.High;
        else if (hasMedium)
            risk = RiskLevel.Moderate;
        else if (findings.Any(f => f.Id is "REPUTATION-001" or "PROVENANCE-001" or "UPDATE-002" or "UPDATE-004" or "UPDATE-005"))
            risk = RiskLevel.Moderate;
        else
            risk = RiskLevel.Indeterminate;

        var summary = risk switch
        {
            RiskLevel.High => "requiere_revision",
            RiskLevel.Moderate => "requiere_revision",
            RiskLevel.Critical => "requiere_revision",
            _ when coverage != AnalysisCoverage.Complete => "analisis_incompleto",
            _ => "requiere_revision"
        };

        return (risk, coverage, summary);
    }

    public static IReadOnlyList<string> BuildMissingChecks(IReadOnlyList<AnalyzerEnvelope> envelopes)
    {
        var lines = new List<string>();
        foreach (var env in envelopes)
        {
            if (env.Status == AnalyzerRunStatus.Failed)
                lines.Add($"El analizador '{env.Analyzer}' no pudo completarse.");
            foreach (var err in env.Errors)
                lines.Add(err);
        }

        if (lines.Count == 0)
            lines.Add("Algunas comprobaciones externas pueden no estar disponibles en este entorno.");

        return lines;
    }

    public static IReadOnlyList<string> BuildRecommendations(IReadOnlyList<Finding> findings, AnalysisCoverage coverage)
    {
        var recs = new List<string>
        {
            "Obtener el archivo desde una fuente oficial verificable del desarrollador."
        };

        if (findings.Any(f => f.Id == "SIGNATURE-001"))
            recs.Add("Verificar manualmente la firma digital y el editor en el sistema operativo.");
        if (coverage != AnalysisCoverage.Complete)
            recs.Add("No interpretar un resultado parcial como garantía de seguridad.");

        return recs.Distinct().ToList();
    }
}
