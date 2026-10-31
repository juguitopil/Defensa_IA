using Microsoft.AspNetCore.Mvc;

namespace SafeUpdate.Api.Controllers;

[ApiController]
[Route("v1/capabilities")]
public sealed class CapabilitiesController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        schemaVersion = "1.0",
        analyzers = new object[]
        {
            new { name = "file_intake", status = "active", note = (string?)null },
            new { name = "hash_service", status = "active", note = (string?)null },
            new { name = "static_analyzer", status = "active", note = "PE superficial" },
            new { name = "provenance_checker", status = "partial", note = "Authenticode pendiente" },
            new { name = "reputation_service", status = "demo", note = "Sin red en MVP" },
            new { name = "url_source", status = "active", note = "Metadatos de URL" },
            new { name = "update_comparison", status = "active", note = "Baseline vs update" },
            new { name = "apk_package", status = "active", note = "ZIP/manifiesto APK" },
            new { name = "multi_engine_scan", status = "demo", note = "Estilo VirusTotal" }
        },
        subjectKinds = new[] { "File", "Url", "Update" },
        limits = new { maxUploadBytes = 33_554_432 }
    });
}
