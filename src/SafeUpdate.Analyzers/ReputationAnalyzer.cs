using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

/// <summary>
/// Stub sin llamadas externas (evita SSRF/API keys en MVP). Simula fuente no disponible.
/// </summary>
public sealed class ReputationAnalyzer : IAnalyzer
{
    public string Name => "reputation_service";

    public bool CanAnalyze(AnalysisContext context) => true;

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>
        {
            new(
                "REPUTATION-001",
                FindingCategory.Reputation,
                FindingSeverity.Info,
                "Reputación externa no consultada en MVP",
                new Dictionary<string, object?> { ["source"] = "disabled", ["queriedAt"] = DateTimeOffset.UtcNow.ToString("O") },
                ["Integrar fuente con API key y timeouts en P1; mostrar fecha de consulta."])
        };

        return Task.FromResult(new AnalyzerEnvelope(
            Name,
            AnalyzerRunStatus.Completed,
            findings,
            ["La fuente de reputación no respondió: modo demo sin red."],
            true));
    }
}
