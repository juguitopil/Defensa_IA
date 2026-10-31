namespace SafeUpdate.Api.Middleware;

/// <summary>
/// Simula identidad propagada desde la plataforma madre (JWT real en integración futura).
/// </summary>
public sealed class HostContextMiddleware(RequestDelegate next)
{
    public const string UserIdItemKey = "HostUserId";
    public const string TenantIdItemKey = "HostTenantId";

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-User-Id", out var userId))
            context.Items[UserIdItemKey] = userId.ToString();
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantId))
            context.Items[TenantIdItemKey] = tenantId.ToString();

        await next(context);
    }
}
