using System.Security.Cryptography;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Analyzers;

public sealed class HashAnalyzer : IAnalyzer
{
    public string Name => "hash_service";

    public bool CanAnalyze(AnalysisContext context) => File.Exists(context.FilePath);

    public async Task<AnalyzerEnvelope> AnalyzeAsync(AnalysisContext context, CancellationToken cancellationToken)
    {
        await using var fs = new FileStream(context.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var hash = await SHA256.HashDataAsync(fs, cancellationToken);
        var hex = Convert.ToHexString(hash).ToLowerInvariant();

        var findings = new List<Finding>
        {
            new(
                "HASH-001",
                FindingCategory.Integrity,
                FindingSeverity.Info,
                "Hash SHA-256 calculado",
                new Dictionary<string, object?> { ["sha256"] = hex },
                [
                    "Un hash identifica una versión concreta; no demuestra por sí solo que el archivo sea seguro.",
                    "La comparación con referencias oficiales no está habilitada en este MVP."
                ])
        };

        return new AnalyzerEnvelope(Name, AnalyzerRunStatus.Completed, findings, [], true);
    }
}
