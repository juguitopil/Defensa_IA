namespace SafeUpdate.Domain;

public enum AnalysisStatus
{
    Queued,
    Running,
    Completed,
    Failed
}

public enum AnalyzerRunStatus
{
    Pending,
    Running,
    Completed,
    Failed,
    Skipped
}

public enum RiskLevel
{
    Low,
    Moderate,
    High,
    Critical,
    Indeterminate
}

public enum AnalysisCoverage
{
    Complete,
    Partial,
    Insufficient
}

public enum FindingSeverity
{
    Info,
    Low,
    Medium,
    High,
    Critical
}

public enum FindingCategory
{
    Provenance,
    Integrity,
    Reputation,
    Static,
    Dependencies,
    Behavior,
    Meta,
    Update
}

public enum AnalysisSubjectKind
{
    File,
    Url,
    Update
}
