using Microsoft.Extensions.DependencyInjection;
using SafeUpdate.Application.Abstractions;

namespace SafeUpdate.Analyzers;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSafeUpdateAnalyzers(this IServiceCollection services)
    {
        services.AddSingleton<IAnalyzer, IsolationWorkerAnalyzer>();
        services.AddSingleton<IAnalyzer, UrlSourceAnalyzer>();
        services.AddSingleton<IAnalyzer, FileIntakeAnalyzer>();
        services.AddSingleton<IAnalyzer, HashAnalyzer>();
        services.AddSingleton<IAnalyzer, StaticAnalyzer>();
        services.AddSingleton<IAnalyzer, ApkPackageAnalyzer>();
        services.AddSingleton<IAnalyzer, UpdateComparisonAnalyzer>();
        services.AddSingleton<IAnalyzer, ProvenanceAnalyzer>();
        services.AddSingleton<IAnalyzer, ReputationAnalyzer>();
        services.AddSingleton<IAnalyzer, MultiEngineScanAnalyzer>();
        return services;
    }
}
