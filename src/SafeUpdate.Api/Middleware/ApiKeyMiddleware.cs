using Microsoft.Extensions.Options;
using SafeUpdate.Application.Options;

namespace SafeUpdate.Api.Middleware;

public sealed class ApiKeyMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IOptions<SafeUpdateOptions> options)
    {
        var configured = options.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(configured))
        {
            await next(context);
            return;
        }

        if (context.Request.Path.StartsWithSegments("/health") ||
            context.Request.Path.StartsWithSegments("/host") ||
            context.Request.Path.StartsWithSegments("/module"))
        {
            await next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Api-Key", out var key) || key != configured)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "API key inválida o ausente." });
            return;
        }

        await next(context);
    }
}
