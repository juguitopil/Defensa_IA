using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Abstractions;

public interface IAnalysisStore
{
    Task AddAsync(AnalysisJob job, CancellationToken cancellationToken);
    Task<AnalysisJob?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task UpdateAsync(AnalysisJob job, CancellationToken cancellationToken);
    Task<IReadOnlyList<AnalysisJob>> DequeueQueuedAsync(int maxItems, CancellationToken cancellationToken);
}
