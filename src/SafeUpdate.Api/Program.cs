using System.Text.Json.Serialization;
using SafeUpdate.Analyzers;
using SafeUpdate.Api.Middleware;
using SafeUpdate.Application;
using SafeUpdate.Application.Options;
using SafeUpdate.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SafeUpdateOptions>(builder.Configuration.GetSection(SafeUpdateOptions.SectionName));
builder.Services.AddSafeUpdateApplication();
builder.Services.AddSafeUpdateAnalyzers();
builder.Services.AddSafeUpdateInfrastructure();

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetIsOriginAllowed(_ => true)));

var app = builder.Build();

app.UseCors();
app.UseMiddleware<HostContextMiddleware>();
app.UseMiddleware<ApiKeyMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "ok", module = "SafeUpdate" }));
app.MapControllers();

var webRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "web"));
if (!Directory.Exists(webRoot))
    webRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "web"));
if (Directory.Exists(webRoot))
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot) });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot) });
    app.MapGet("/host", () => Results.Redirect("/host-demo.html"));
    app.MapGet("/module", () => Results.Redirect("/safe-update-module/index.html"));
}

app.Run();
