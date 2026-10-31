using System.IO.Compression;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class ApkPackageAnalyzer : IAnalyzer
{
    public string Name => "apk_package";

    public bool CanAnalyze(AnalysisContext context) =>
        Path.GetExtension(context.OriginalFileName).Equals(".apk", StringComparison.OrdinalIgnoreCase);

    public Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>();
        try
        {
            using var zip = ZipFile.OpenRead(context.PrimaryFilePath);
            var manifest = zip.GetEntry("AndroidManifest.xml");
            findings.Add(new Finding(
                "APK-001",
                FindingCategory.Static,
                FindingSeverity.Info,
                "Paquete APK (ZIP) legible",
                new Dictionary<string, object?> { ["entryCount"] = zip.Entries.Count },
                ["No se instaló la app; inspección estática del contenedor."]));

            if (manifest is null)
            {
                findings.Add(new Finding(
                    "APK-002",
                    FindingCategory.Static,
                    FindingSeverity.High,
                    "Falta AndroidManifest.xml",
                    new Dictionary<string, object?>(),
                    ["Un APK válido debería incluir manifiesto."]));
            }
            else
            {
                findings.Add(new Finding(
                    "APK-003",
                    FindingCategory.Static,
                    FindingSeverity.Info,
                    "AndroidManifest.xml presente",
                    new Dictionary<string, object?>(),
                    ["Análisis profundo de permisos/certificado: fase P1 en sandbox."]));
            }
        }
        catch (InvalidDataException)
        {
            return Task.FromResult(new AnalyzerEnvelope(
                Name, AnalyzerRunStatus.Completed,
                [
                    new Finding("APK-004", FindingCategory.Static, FindingSeverity.High,
                        "El archivo .apk no es un ZIP válido", new Dictionary<string, object?>(), [])
                ], [], true));
        }

        return Task.FromResult(new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true));
    }
}
