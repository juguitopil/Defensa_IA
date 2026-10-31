using SafeUpdate.Application.Services;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;
using Xunit;

namespace SafeUpdate.Application.Tests;

public class RiskEngineTests
{
    [Fact]
    public void Incomplete_analyzers_yield_insufficient_coverage()
    {
        var envelopes = new List<AnalyzerEnvelope>
        {
            new("hash_service", AnalyzerRunStatus.Completed, [], [], true),
            new("reputation_service", AnalyzerRunStatus.Failed, [], ["timeout"], true)
        };

        var (risk, coverage, _) = RiskEngine.Evaluate([], envelopes);
        Assert.Equal(AnalysisCoverage.Insufficient, coverage);
        Assert.Equal(RiskLevel.Indeterminate, risk);
    }

    [Fact]
    public void High_severity_finding_elevates_risk()
    {
        var findings = new List<Finding>
        {
            new("X-1", FindingCategory.Static, FindingSeverity.High, "test", new Dictionary<string, object?>(), [])
        };
        var envelopes = AllCompletedEnvelopes();

        var (risk, _, _) = RiskEngine.Evaluate(findings, envelopes);
        Assert.Equal(RiskLevel.High, risk);
    }

    private static List<AnalyzerEnvelope> AllCompletedEnvelopes() =>
    [
        new("file_intake", AnalyzerRunStatus.Completed, [], [], true),
        new("hash_service", AnalyzerRunStatus.Completed, [], [], true),
        new("static_analyzer", AnalyzerRunStatus.Completed, [], [], true),
        new("reputation_service", AnalyzerRunStatus.Completed, [], [], true),
        new("provenance_checker", AnalyzerRunStatus.Completed, [], [], true)
    ];
}
