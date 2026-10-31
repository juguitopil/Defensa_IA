using System.Security.Cryptography;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

/// <summary>
/// Compara artefacto instalado (baseline) vs actualización candidata: integridad, tipo y versión declarada.
/// </summary>
public sealed class UpdateComparisonAnalyzer : IAnalyzer
{
    public string Name => "update_comparison";

    public bool CanAnalyze(AnalysisContext context) =>
        context.SubjectKind == AnalysisSubjectKind.Update;

    public async Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        var findings = new List<Finding>();
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(context.BaselineFilePath) || !File.Exists(context.BaselineFilePath))
        {
            findings.Add(new Finding(
                "UPDATE-000",
                FindingCategory.Update,
                FindingSeverity.Medium,
                "Sin copia de la versión instalada para comparar",
                new Dictionary<string, object?>(),
                ["Sube el APK/instalador actual (baseline) para detectar cambios sospechosos en la actualización."]));
        }
        else
        {
            var baseHash = await HashFileAsync(context.BaselineFilePath, cancellationToken);
            var newHash = await HashFileAsync(context.PrimaryFilePath, cancellationToken);
            var baseSize = new FileInfo(context.BaselineFilePath).Length;
            var newSize = new FileInfo(context.PrimaryFilePath).Length;

            findings.Add(new Finding(
                "UPDATE-001",
                FindingCategory.Update,
                FindingSeverity.Info,
                "Hash distinto entre instalado y actualización (esperable al actualizar)",
                new Dictionary<string, object?>
                {
                    ["baselineSha256"] = baseHash,
                    ["updateSha256"] = newHash,
                    ["hashesEqual"] = baseHash == newHash
                },
                ["Si los hashes fueran iguales, la actualización no cambiaría el binario."]));

            if (baseHash == newHash)
            {
                findings.Add(new Finding(
                    "UPDATE-002",
                    FindingCategory.Update,
                    FindingSeverity.High,
                    "La actualización es idéntica al artefacto instalado",
                    new Dictionary<string, object?>(),
                    ["Puede ser un falso actualizador o un error de empaquetado."]));
            }

            if (baseSize > 0)
            {
                var ratio = (double)newSize / baseSize;
                if (ratio > 3 || ratio < 0.25)
                {
                    findings.Add(new Finding(
                        "UPDATE-003",
                        FindingCategory.Update,
                        FindingSeverity.Medium,
                        "Cambio de tamaño inusual entre versiones",
                        new Dictionary<string, object?> { ["sizeRatio"] = ratio, ["baselineBytes"] = baseSize, ["updateBytes"] = newSize },
                        ["Puede ser legítimo; conviene revisar notas de versión y firma del editor."]));
                }
            }

            var basePe = await IsPeAsync(context.BaselineFilePath, cancellationToken);
            var newPe = await IsPeAsync(context.PrimaryFilePath, cancellationToken);
            if (basePe != newPe)
            {
                findings.Add(new Finding(
                    "UPDATE-004",
                    FindingCategory.Update,
                    FindingSeverity.High,
                    "Cambio de tipo de binario respecto a la versión instalada",
                    new Dictionary<string, object?> { ["baselinePe"] = basePe, ["updatePe"] = newPe },
                    ["Un actualizador no debería cambiar el formato fundamental del producto."]));
            }
        }

        if (!string.IsNullOrWhiteSpace(context.InstalledVersion) &&
            !string.IsNullOrWhiteSpace(context.OfferedVersion) &&
            TryParseVersion(context.InstalledVersion, out var installed) &&
            TryParseVersion(context.OfferedVersion, out var offered) &&
            offered < installed)
        {
            findings.Add(new Finding(
                "UPDATE-005",
                FindingCategory.Update,
                FindingSeverity.High,
                "Posible downgrade de versión",
                new Dictionary<string, object?>
                {
                    ["installedVersion"] = context.InstalledVersion,
                    ["offeredVersion"] = context.OfferedVersion
                },
                ["Las actualizaciones legítimas rara vez bajan de versión sin aviso explícito."]));
        }

        return new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, errors, true);
    }

    private static async Task<string> HashFileAsync(string path, CancellationToken cancellationToken)
    {
        await using var fs = File.OpenRead(path);
        var hash = await SHA256.HashDataAsync(fs, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static async Task<bool> IsPeAsync(string path, CancellationToken cancellationToken)
    {
        await using var fs = File.OpenRead(path);
        var buf = new byte[2];
        var n = await fs.ReadAsync(buf.AsMemory(0, 2), cancellationToken);
        return n >= 2 && buf[0] == (byte)'M' && buf[1] == (byte)'Z';
    }

    private static bool TryParseVersion(string input, out Version version)
    {
        version = new Version(0, 0);
        var cleaned = new string(input.Trim().TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
        return Version.TryParse(cleaned, out version);
    }
}
