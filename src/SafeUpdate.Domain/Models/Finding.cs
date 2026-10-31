namespace SafeUpdate.Domain.Models;

public sealed record Finding(
    string Id,
    FindingCategory Category,
    FindingSeverity Severity,
    string Title,
    IReadOnlyDictionary<string, object?> Evidence,
    IReadOnlyList<string> Limitations);
