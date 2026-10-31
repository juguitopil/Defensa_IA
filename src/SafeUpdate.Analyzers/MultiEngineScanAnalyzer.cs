using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

/// <summary>
/// Simula el panel multi-motor estilo VirusTotal (demo sin red). Sustituir por APIs reales en worker aislado.
/// </summary>
public sealed class MultiEngineScanAnalyzer : IAnalyzer
{
    public string Name => "multi_engine_scan";

    public bool CanAnalyze(AnalysisContext context) => File.Exists(context.PrimaryFilePath);

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var engines = new[]
        {
            new { engine = "SafeUpdate-Static", result = "sin_indicadores_concluyentes" },
            new { engine = "SafeUpdate-Reputation-Demo", result = "no_consultado" },
            new { engine = "SafeUpdate-Sandbox", result = "no_ejecutado" }
        };

        var findings = new List<Finding>
        {
            new(
                "SCAN-001",
                FindingCategory.Reputation,
                FindingSeverity.Info,
                "Escaneo multi-motor (modo demo)",
                new Dictionary<string, object?> { ["engines"] = engines },
                [
                    "En producción cada motor consulta fuentes distintas desde el worker aislado.",
                    "Ausencia de detecciones no implica archivo seguro."
                ])
        };

        return Task.FromResult(new AnalyzerEnvelope(
            Name,
            AnalyzerRunStatus.Completed,
            findings,
            ["Motores externos reales pendientes de integración (VT híbrido / APIs con clave)."],
            true));
    }
}
