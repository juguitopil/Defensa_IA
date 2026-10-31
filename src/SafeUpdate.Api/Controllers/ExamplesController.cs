using Microsoft.AspNetCore.Mvc;
using SafeUpdate.Api.Middleware;
using SafeUpdate.Application.Services;

namespace SafeUpdate.Api.Controllers;

[ApiController]
[Route("v1/examples")]
public sealed class ExamplesController(AnalysisService analysisService, IWebHostEnvironment env) : ControllerBase
{
    private static readonly IReadOnlyList<ExampleItem> Catalog =
    [
        new("legitimo", "Documento benigno", "file", "demo-legitimo.txt", null, null, null, "Muestra hash y limitaciones sin afirmar que es seguro."),
        new("vacio", "Archivo vacío", "file", "demo-vacio.txt", null, null, null, "Detecta INTAKE-001: archivo vacío."),
        new("falso-exe", "Falso .exe (no es PE)", "file", "demo-falso.exe", null, null, null, "Extensión .exe pero contenido de texto: STATIC-001."),
        new("pe-superficial", "Cabecera PE (MZ)", "file", "demo-pe.exe", null, null, null, "Detecta contenedor PE sin ejecutarlo."),
        new("apk", "APK de demo (ZIP)", "file", "demo-app.apk", null, null, null, "Paquete APK con AndroidManifest.xml."),
        new("update-ok", "Actualización distinta", "update", "demo-actualizacion.txt", "demo-instalado.txt", "1.0.0", "2.0.0", "Compara baseline vs update: UPDATE-001."),
        new("update-igual", "Falso actualizador (idéntico)", "update", "demo-igual.txt", "demo-igual.txt", "1.0.0", "1.0.1", "Mismo hash: UPDATE-002."),
        new("update-downgrade", "Posible downgrade", "update", "demo-instalado.txt", "demo-actualizacion.txt", "2.0.0", "1.0.0", "Versión ofrecida menor: UPDATE-005.")
    ];

    [HttpGet]
    public IActionResult List() => Ok(new
    {
        ui = "/host",
        items = Catalog.Select(c => new
        {
            c.Id,
            c.Title,
            c.Mode,
            c.TalkingPoint
        })
    });

    [HttpPost("{id}")]
    public async Task<IActionResult> Run(string id, CancellationToken cancellationToken)
    {
        var item = Catalog.FirstOrDefault(c => c.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
        if (item is null)
            return NotFound(new { error = "Ejemplo desconocido." });

        var root = ResolveExamplesRoot();
        if (root is null)
            return Problem("No se encontró la carpeta examples/.");

        var tenantId = HttpContext.Items[HostContextMiddleware.TenantIdItemKey] as string;
        var userId = HttpContext.Items[HostContextMiddleware.UserIdItemKey] as string;

        try
        {
            var primaryPath = Path.Combine(root, item.PrimaryFile);
            await using var primary = System.IO.File.OpenRead(primaryPath);

            if (item.Mode == "update")
            {
                var baselinePath = Path.Combine(root, item.BaselineFile!);
                await using var baseline = System.IO.File.OpenRead(baselinePath);
                var job = await analysisService.CreateUpdateAnalysisAsync(
                    primary, item.PrimaryFile,
                    baseline, item.BaselineFile,
                    null, tenantId, userId, item.Title,
                    item.InstalledVersion, item.OfferedVersion, cancellationToken);
                return Accepted(new { id = job.Id, example = item.Id, status = job.Status.ToString() });
            }

            var fileJob = await analysisService.CreateFromUploadAsync(
                primary, item.PrimaryFile, tenantId, userId, item.Title, cancellationToken);
            return Accepted(new { id = fileJob.Id, example = item.Id, status = fileJob.Status.ToString() });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private string? ResolveExamplesRoot()
    {
        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(env.ContentRootPath, "examples")),
            Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "examples"))
        };
        return candidates.FirstOrDefault(Directory.Exists);
    }

    private sealed record ExampleItem(
        string Id,
        string Title,
        string Mode,
        string PrimaryFile,
        string? BaselineFile,
        string? InstalledVersion,
        string? OfferedVersion,
        string TalkingPoint);
}
