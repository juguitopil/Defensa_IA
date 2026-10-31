using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Application.Options;
using SafeUpdate.Application.Services;
using SafeUpdate.Domain;

namespace SafeUpdate.Infrastructure.Workers;

/// <summary>
/// Procesa la cola en segundo plano (MVP). Extraíble a worker/contenedor aislado sin cambiar analizadores.
/// </summary>
public sealed class AnalysisWorkerHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAnalysisQueue _queue;
    private readonly SafeUpdateOptions _options;
    private readonly ILogger<AnalysisWorkerHostedService> _logger;

    public AnalysisWorkerHostedService(
        IServiceScopeFactory scopeFactory,
        IAnalysisQueue queue,
        IOptions<SafeUpdateOptions> options,
        ILogger<AnalysisWorkerHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _queue = queue;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var jobId = await _queue.DequeueAsync(stoppingToken);
                using var scope = _scopeFactory.CreateScope();
                var store = scope.ServiceProvider.GetRequiredService<IAnalysisStore>();
                var storage = scope.ServiceProvider.GetRequiredService<ISecureFileStorage>();
                var preparer = scope.ServiceProvider.GetRequiredService<AnalysisJobPreparer>();
                var orchestrator = scope.ServiceProvider.GetRequiredService<AnalysisOrchestrator>();

                var job = await store.GetAsync(jobId, stoppingToken);
                if (job is null)
                    continue;

                using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts.CancelAfter(TimeSpan.FromSeconds(_options.AnalysisTimeoutSeconds));

                try
                {
                    await preparer.EnsureArtifactsAsync(job, cts.Token);
                    await orchestrator.RunAsync(job, storage, cts.Token);
                }
                catch (Exception ex)
                {
                    job.Status = AnalysisStatus.Failed;
                    job.FailureReason = ex.Message;
                    job.CompletedAt = DateTimeOffset.UtcNow;
                    _logger.LogWarning(ex, "Análisis fallido {JobId}", jobId);
                }

                await store.UpdateAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
