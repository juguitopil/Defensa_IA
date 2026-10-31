using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class UrlSourceAnalyzer : IAnalyzer
{
    public string Name => "url_source";

    public bool CanAnalyze(AnalysisContext context) =>
        !string.IsNullOrWhiteSpace(context.SourceUrl);

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>();
        if (!Uri.TryCreate(context.SourceUrl, UriKind.Absolute, out var uri))
        {
            return Task.FromResult(new AnalyzerEnvelope(
                Name, AnalyzerRunStatus.Failed, [],
                ["URL inválida."], true));
        }

        if (uri.Scheme != Uri.UriSchemeHttps)
        {
            findings.Add(new Finding(
                "URL-001",
                FindingCategory.Provenance,
                FindingSeverity.Medium,
                "La descarga no usa HTTPS",
                new Dictionary<string, object?> { ["scheme"] = uri.Scheme },
                ["Las descargas sin cifrado son más susceptibles a manipulación en tránsito."]));
        }

        findings.Add(new Finding(
            "URL-002",
            FindingCategory.Provenance,
            FindingSeverity.Info,
            "Origen por URL registrado",
            new Dictionary<string, object?>
            {
                ["host"] = uri.Host,
                ["path"] = uri.AbsolutePath
            },
            ["Verificar manualmente que el dominio pertenece al desarrollador oficial."]));

        return Task.FromResult(new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true));
    }
}
