using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class FileIntakeAnalyzer : IAnalyzer
{
    public string Name => "file_intake";

    public bool CanAnalyze(AnalysisContext context) => true;

    public async Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>();
        var info = new FileInfo(context.FilePath);
        if (!info.Exists)
        {
            return new AnalyzerEnvelope(Name, AnalyzerRunStatus.Failed, [], ["Archivo no encontrado en almacenamiento seguro."], true);
        }

        if (info.Length == 0)
        {
            findings.Add(new Finding(
                "INTAKE-001",
                FindingCategory.Meta,
                FindingSeverity.Medium,
                "Archivo vacío",
                new Dictionary<string, object?> { ["sizeBytes"] = 0 },
                ["Un instalador vacío no es un artefacto válido para evaluar confianza."]));
        }

        await using var fs = new FileStream(context.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var header = new byte[4];
        var read = await fs.ReadAsync(header.AsMemory(0, 4), cancellationToken);
        var magic = read >= 2 ? $"{(char)header[0]}{(char)header[1]}" : "??";

        findings.Add(new Finding(
            "INTAKE-002",
            FindingCategory.Meta,
            FindingSeverity.Info,
            "Tipo preliminar por firma mágica",
            new Dictionary<string, object?>
            {
                ["magic"] = magic,
                ["sizeBytes"] = info.Length,
                ["extension"] = Path.GetExtension(context.OriginalFileName)
            },
            ["La firma mágica no garantiza el tipo real del archivo."]));

        return new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true);
    }
}
