using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

/// <summary>
/// MVP: no invoca WinVerifyTrust. Placeholder seguro para pruebas técnicas y extensión Windows.
/// </summary>
public sealed class ProvenanceAnalyzer : IAnalyzer
{
    public string Name => "provenance_checker";

    public bool CanAnalyze(AnalysisContext context) => File.Exists(context.FilePath);

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>
        {
            new(
                "SIGNATURE-001",
                FindingCategory.Provenance,
                FindingSeverity.Medium,
                "Verificación Authenticode pendiente de implementación",
                new Dictionary<string, object?>
                {
                    ["signatureVerified"] = false,
                    ["platform"] = OperatingSystem.IsWindows() ? "windows" : "non-windows"
                },
                [
                    "En MVP no se afirma validez de certificado.",
                    "Integrar WinVerifyTrust en entorno aislado en fase P1."
                ])
        };

        if (!string.IsNullOrWhiteSpace(context.ExpectedProduct))
        {
            findings.Add(new Finding(
                "PROVENANCE-002",
                FindingCategory.Provenance,
                FindingSeverity.Info,
                "Producto esperado registrado para comparación futura",
                new Dictionary<string, object?> { ["expectedProduct"] = context.ExpectedProduct },
                ["Aún no se contrasta editor del binario con el producto esperado."]));
        }
        else
        {
            findings.Add(new Finding(
                "PROVENANCE-001",
                FindingCategory.Provenance,
                FindingSeverity.Medium,
                "Procedencia no verificada",
                new Dictionary<string, object?>(),
                ["No se indicó producto esperado ni hash de referencia oficial."]));
        }

        return Task.FromResult(new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true));
    }
}
