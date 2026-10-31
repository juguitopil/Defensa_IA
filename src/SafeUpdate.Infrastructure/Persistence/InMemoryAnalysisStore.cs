using System.Collections.Concurrent;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Infrastructure.Persistence;

public sealed class InMemoryAnalysisStore : IAnalysisStore
{
    private readonly ConcurrentDictionary<Guid, AnalysisJob> _jobs = new();

    public Task AddAsync(AnalysisJob job, CancellationToken cancellationToken)
    {
        _jobs[job.Id] = job;
        return Task.CompletedTask;
    }

    public Task<AnalysisJob?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(_jobs.TryGetValue(id, out var job) ? job : null);

    public Task UpdateAsync(AnalysisJob job, CancellationToken cancellationToken)
    {
        _jobs[job.Id] = job;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AnalysisJob>> DequeueQueuedAsync(int maxItems, CancellationToken cancellationToken)
    {
        var list = _jobs.Values
            .Where(j => j.Status == AnalysisStatus.Queued)
            .OrderBy(j => j.CreatedAt)
            .Take(maxItems)
            .ToList();
        return Task.FromResult<IReadOnlyList<AnalysisJob>>(list);
    }
}
