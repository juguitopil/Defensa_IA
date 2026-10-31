using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public static class FindingsCorrelator
{
    public static IReadOnlyList<Finding> Merge(IEnumerable<AnalyzerEnvelope> envelopes)
    {
        var byId = new Dictionary<string, Finding>(StringComparer.OrdinalIgnoreCase);
        foreach (var envelope in envelopes)
        {
            foreach (var finding in envelope.Findings)
            {
                byId.TryAdd(finding.Id, finding);
            }
        }

        return byId.Values.OrderBy(f => f.Id, StringComparer.Ordinal).ToList();
    }
}
