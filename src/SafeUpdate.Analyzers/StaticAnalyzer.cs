using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class StaticAnalyzer : IAnalyzer
{
    public string Name => "static_analyzer";

    public bool CanAnalyze(AnalysisContext context) => File.Exists(context.FilePath);

    public async Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>();
        await using var fs = new FileStream(context.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var buf = new byte[64];
        var n = await fs.ReadAsync(buf.AsMemory(0, buf.Length), cancellationToken);

        var isPe = n >= 2 && buf[0] == (byte)'M' && buf[1] == (byte)'Z';
        var ext = Path.GetExtension(context.OriginalFileName).ToLowerInvariant();
        var peExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".exe", ".dll", ".sys", ".msi" };

        if (peExtensions.Contains(ext) && !isPe)
        {
            findings.Add(new Finding(
                "STATIC-001",
                FindingCategory.Static,
                FindingSeverity.Medium,
                "Extensión inconsistente con contenido",
                new Dictionary<string, object?> { ["extension"] = ext, ["peHeader"] = isPe },
                ["Puede ser un archivo renombrado; requiere verificación manual."]));
        }

        if (isPe)
        {
            findings.Add(new Finding(
                "STATIC-002",
                FindingCategory.Static,
                FindingSeverity.Info,
                "Contenedor PE detectado (cabecera MZ)",
                new Dictionary<string, object?> { ["peHeader"] = true },
                ["No se ejecutó el binario; solo inspección estática superficial."]));
        }
        else if (findings.Count == 0)
        {
            findings.Add(new Finding(
                "STATIC-003",
                FindingCategory.Static,
                FindingSeverity.Info,
                "Sin indicadores estáticos concluyentes en MVP",
                new Dictionary<string, object?>(),
                ["Formato no PE o análisis profundo no implementado aún."]));
        }

        return new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true);
    }
}
