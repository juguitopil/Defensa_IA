using Microsoft.Extensions.DependencyInjection;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Infrastructure.Network;
using SafeUpdate.Infrastructure.Persistence;
using SafeUpdate.Infrastructure.Queue;
using SafeUpdate.Infrastructure.Storage;
using SafeUpdate.Infrastructure.Workers;

namespace SafeUpdate.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSafeUpdateInfrastructure(this IServiceCollection services)
    {
        services.AddHttpClient("SafeUpdateFetcher", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("SafeUpdate-IsolatedWorker/1.0");
        });
        services.AddSingleton<IAnalysisStore, InMemoryAnalysisStore>();
        services.AddSingleton<IAnalysisQueue, ChannelAnalysisQueue>();
        services.AddSingleton<ISecureFileStorage, SecureLocalFileStorage>();
        services.AddSingleton<ISafeUrlFetcher, SafeUrlFetcher>();
        services.AddHostedService<AnalysisWorkerHostedService>();
        return services;
    }
}
