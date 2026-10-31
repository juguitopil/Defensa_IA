using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public sealed class TemplateExplainer : IExplainer
{
    public Task<string?> ExplainAsync(ReportV1 report, CancellationToken cancellationToken)
    {
        var risk = report.RiskLevel switch
        {
            RiskLevel.Low => "el nivel de alerta es bajo",
            RiskLevel.Moderate => "conviene revisar el archivo antes de instalarlo",
            RiskLevel.High => "el nivel de alerta es alto",
            RiskLevel.Critical => "el nivel de alerta es crítico",
            _ => "aún no hay información suficiente para decidir"
        };

        var coverage = report.Coverage switch
        {
            AnalysisCoverage.Complete => "Se pudieron completar las comprobaciones previstas de esta versión.",
            AnalysisCoverage.Partial => "El análisis quedó a medias: faltan algunas comprobaciones.",
            _ => "Casi no se pudo completar el análisis."
        };

        var parts = new List<string>
        {
            $"Se revisó «{report.FileName}»: {risk}.",
            coverage,
            "Que no aparezca un virus no quiere decir que el archivo sea seguro."
        };

        foreach (var rec in report.Recommendations.Take(3))
            parts.Add(rec);

        return Task.FromResult<string?>(string.Join(" ", parts));
    }
}
