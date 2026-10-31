using Microsoft.Extensions.DependencyInjection;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Application.Services;

namespace SafeUpdate.Application;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSafeUpdateApplication(this IServiceCollection services)
    {
        services.AddSingleton<IExplainer, TemplateExplainer>();
        services.AddSingleton<AnalysisOrchestrator>();
        services.AddSingleton<AnalysisJobPreparer>();
        services.AddSingleton<AnalysisService>();
        return services;
    }
}
