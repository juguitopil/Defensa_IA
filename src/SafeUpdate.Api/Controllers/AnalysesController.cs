using Microsoft.AspNetCore.Mvc;
using SafeUpdate.Api.Middleware;
using SafeUpdate.Application.Services;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Api.Controllers;

[ApiController]
[Route("v1/analyses")]
public sealed class AnalysesController(AnalysisService analysisService) : ControllerBase
{
    /// <summary>
    /// mode: file | url | update
    /// file: campo file
    /// url: downloadUrl
    /// update: updateFile o downloadUrl + opcional baselineFile (app instalada), installedVersion, offeredVersion
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(70_000_000)]
    public async Task<IActionResult> Create(
        [FromForm] string? mode,
        IFormFile? file,
        IFormFile? updateFile,
        IFormFile? baselineFile,
        [FromForm] string? downloadUrl,
        [FromForm] string? expectedProduct,
        [FromForm] string? installedVersion,
        [FromForm] string? offeredVersion,
        CancellationToken cancellationToken)
    {
        var tenantId = HttpContext.Items[HostContextMiddleware.TenantIdItemKey] as string;
        var userId = HttpContext.Items[HostContextMiddleware.UserIdItemKey] as string;
        var normalizedMode = (mode ?? InferMode(file, updateFile, downloadUrl)).Trim().ToLowerInvariant();

        try
        {
            AnalysisJob job = normalizedMode switch
            {
                "url" => await analysisService.CreateFromUrlAsync(
                    downloadUrl ?? throw new InvalidOperationException("Falta downloadUrl."),
                    tenantId, userId, expectedProduct, cancellationToken),

                "update" => await CreateUpdateAsync(
                    updateFile, baselineFile, downloadUrl,
                    tenantId, userId, expectedProduct, installedVersion, offeredVersion, cancellationToken),

                _ => await CreateFileAsync(file, tenantId, userId, expectedProduct, cancellationToken)
            };

            return Accepted(new
            {
                id = job.Id,
                subjectKind = job.SubjectKind.ToString(),
                status = job.Status.ToString(),
                links = new { self = Url.Action(nameof(Get), new { id = job.Id }) }
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task<AnalysisJob> CreateFileAsync(
        IFormFile? file, string? tenantId, string? userId, string? expectedProduct, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            throw new InvalidOperationException("Se requiere 'file' en mode=file.");
        await using var stream = file.OpenReadStream();
        return await analysisService.CreateFromUploadAsync(
            stream, file.FileName, tenantId, userId, expectedProduct, cancellationToken);
    }

    private async Task<AnalysisJob> CreateUpdateAsync(
        IFormFile? updateFile,
        IFormFile? baselineFile,
        string? downloadUrl,
        string? tenantId,
        string? userId,
        string? expectedProduct,
        string? installedVersion,
        string? offeredVersion,
        CancellationToken cancellationToken)
    {
        if (updateFile is { Length: > 0 })
        {
            await using var updateStream = updateFile.OpenReadStream();
            if (baselineFile is { Length: > 0 })
            {
                await using var baselineStream = baselineFile.OpenReadStream();
                return await analysisService.CreateUpdateAnalysisAsync(
                    updateStream, updateFile.FileName,
                    baselineStream, baselineFile.FileName,
                    downloadUrl, tenantId, userId, expectedProduct,
                    installedVersion, offeredVersion, cancellationToken);
            }

            return await analysisService.CreateUpdateAnalysisAsync(
                updateStream, updateFile.FileName,
                null, null,
                downloadUrl, tenantId, userId, expectedProduct,
                installedVersion, offeredVersion, cancellationToken);
        }

        if (baselineFile is { Length: > 0 })
        {
            await using var baselineStream = baselineFile.OpenReadStream();
            return await analysisService.CreateUpdateAnalysisAsync(
                null, null,
                baselineStream, baselineFile.FileName,
                downloadUrl, tenantId, userId, expectedProduct,
                installedVersion, offeredVersion, cancellationToken);
        }

        return await analysisService.CreateUpdateAnalysisAsync(
            null, null, null, null,
            downloadUrl, tenantId, userId, expectedProduct,
            installedVersion, offeredVersion, cancellationToken);
    }

    private static string InferMode(IFormFile? file, IFormFile? updateFile, string? downloadUrl)
    {
        if (!string.IsNullOrWhiteSpace(downloadUrl) && updateFile is null && file is null)
            return "url";
        if (updateFile is not null || (!string.IsNullOrWhiteSpace(downloadUrl) && file is null))
            return "update";
        return "file";
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var job = await analysisService.GetAsync(id, cancellationToken);
        if (job is null)
            return NotFound();

        return Ok(new
        {
            id = job.Id,
            subjectKind = job.SubjectKind.ToString(),
            status = job.Status.ToString(),
            fileName = job.OriginalFileName,
            sourceUrl = job.SourceUrl,
            sizeBytes = job.FileSizeBytes,
            sha256 = job.Sha256,
            installedVersion = job.InstalledVersion,
            offeredVersion = job.OfferedVersion,
            createdAt = job.CreatedAt,
            completedAt = job.CompletedAt,
            failureReason = job.FailureReason,
            analyzerResults = job.AnalyzerResults,
            report = job.Report
        });
    }

    [HttpGet("{id:guid}/report")]
    public async Task<IActionResult> GetReport(Guid id, CancellationToken cancellationToken)
    {
        var job = await analysisService.GetAsync(id, cancellationToken);
        if (job is null)
            return NotFound();
        if (job.Report is null)
            return Accepted(new { status = job.Status.ToString(), message = "Informe aún no disponible." });

        return Ok(job.Report);
    }
}
