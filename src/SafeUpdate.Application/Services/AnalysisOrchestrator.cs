using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public sealed class AnalysisOrchestrator
{
    private readonly IEnumerable<IAnalyzer> _analyzers;
    private readonly IExplainer _explainer;

    public AnalysisOrchestrator(IEnumerable<IAnalyzer> analyzers, IExplainer explainer)
    {
        _analyzers = analyzers;
        _explainer = explainer;
    }

    public async Task RunAsync(AnalysisJob job, ISecureFileStorage storage, CancellationToken cancellationToken)
    {
        job.Status = AnalysisStatus.Running;
        var primaryPath = storage.GetFullPath(job.StoredFileName);
        string? baselinePath = job.BaselineStoredFileName is not null
            ? storage.GetFullPath(job.BaselineStoredFileName)
            : null;

        var context = new AnalysisContext(
            job.Id,
            job.SubjectKind,
            primaryPath,
            job.OriginalFileName,
            baselinePath,
            job.SourceUrl,
            job.ExpectedProduct,
            job.InstalledVersion,
            job.OfferedVersion);
        job.AnalyzerResults.Clear();

        foreach (var analyzer in _analyzers.OrderBy(a => a.Name, StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!analyzer.CanAnalyze(context))
            {
                job.AnalyzerResults.Add(new AnalyzerEnvelope(
                    analyzer.Name,
                    AnalyzerRunStatus.Skipped,
                    [],
                    ["Formato o contexto no compatible con este analizador."],
                    CountsTowardCoverage: false));
                continue;
            }

            try
            {
                var result = await analyzer.AnalyzeAsync(context, cancellationToken);
                job.AnalyzerResults.Add(result);
                if (analyzer.Name == "hash_service")
                {
                    var hashFinding = result.Findings.FirstOrDefault(f => f.Id == "HASH-001");
                    if (hashFinding?.Evidence.TryGetValue("sha256", out var hash) == true && hash is string s)
                        job.Sha256 = s;
                }
            }
            catch (Exception ex)
            {
                job.AnalyzerResults.Add(new AnalyzerEnvelope(
                    analyzer.Name,
                    AnalyzerRunStatus.Failed,
                    [],
                    [$"Error interno del analizador: {ex.Message}"],
                    CountsTowardCoverage: true));
            }
        }

        var merged = FindingsCorrelator.Merge(job.AnalyzerResults);
        var narrative = await _explainer.ExplainAsync(
            ReportBuilder.Build(job, merged, null),
            cancellationToken);
        job.Report = ReportBuilder.Build(job, merged, narrative);
        job.Status = AnalysisStatus.Completed;
        job.CompletedAt = DateTimeOffset.UtcNow;
    }
}
