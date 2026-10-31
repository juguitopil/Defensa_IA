using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Abstractions;

public interface IExplainer
{
    Task<string?> ExplainAsync(ReportV1 report, CancellationToken cancellationToken);
}
