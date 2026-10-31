using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class IsolationWorkerAnalyzer : IAnalyzer
{
    public string Name => "isolation_worker";

    public bool CanAnalyze(AnalysisContext context) => true;

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>
        {
            new(
                "ISO-001",
                FindingCategory.Meta,
                FindingSeverity.Info,
                "Procesamiento en worker de cola (MVP)",
                new Dictionary<string, object?>
                {
                    ["execution"] = "static_only",
                    ["dynamicSandbox"] = false,
                    ["subjectKind"] = context.SubjectKind.ToString()
                },
                [
                    "Fase siguiente: contenedor sin credenciales para descargas URL y sandbox dinámico.",
                    "Las apps instaladas se comparan subiendo baseline + actualización; no hay agente en el dispositivo aún."
                ])
        };

        return Task.FromResult(new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], false));
    }
}
