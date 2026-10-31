using SafeUpdate.Application.Abstractions;
using SafeUpdate.Application.Options;
using SafeUpdate.Domain;
using SafeUpdate.Domain.Models;
using Microsoft.Extensions.Options;

namespace SafeUpdate.Application.Services;

public sealed class AnalysisService
{
    private readonly IAnalysisStore _store;
    private readonly IAnalysisQueue _queue;
    private readonly ISecureFileStorage _storage;
    private readonly SafeUpdateOptions _options;

    public AnalysisService(
        IAnalysisStore store,
        IAnalysisQueue queue,
        ISecureFileStorage storage,
        IOptions<SafeUpdateOptions> options)
    {
        _store = store;
        _queue = queue;
        _storage = storage;
        _options = options.Value;
    }

    public async Task<AnalysisJob> CreateFromUploadAsync(
        Stream fileStream,
        string originalFileName,
        string? tenantId,
        string? userId,
        string? expectedProduct,
        CancellationToken cancellationToken) =>
        await CreateJobWithPrimaryFileAsync(
            AnalysisSubjectKind.File,
            fileStream,
            originalFileName,
            baselineStream: null,
            baselineName: null,
            sourceUrl: null,
            tenantId,
            userId,
            expectedProduct,
            installedVersion: null,
            offeredVersion: null,
            cancellationToken);

    public async Task<AnalysisJob> CreateFromUrlAsync(
        string downloadUrl,
        string? tenantId,
        string? userId,
        string? expectedProduct,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("URL inválida.");
        if (!UrlSafetyValidator.TryValidate(uri, out var urlError))
            throw new InvalidOperationException(urlError);
        if (!UrlSafetyValidator.LooksLikeDirectFileUrl(uri, out var urlHint))
            throw new InvalidOperationException(urlHint);

        var job = new AnalysisJob
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            SubjectKind = AnalysisSubjectKind.Url,
            SourceUrl = uri.ToString(),
            OriginalFileName = "pending-download",
            ExpectedProduct = TrimProduct(expectedProduct),
            Status = AnalysisStatus.Queued
        };

        await _store.AddAsync(job, cancellationToken);
        await _queue.EnqueueAsync(job.Id, cancellationToken);
        return job;
    }

    public async Task<AnalysisJob> CreateUpdateAnalysisAsync(
        Stream? updateStream,
        string? updateFileName,
        Stream? baselineStream,
        string? baselineFileName,
        string? downloadUrl,
        string? tenantId,
        string? userId,
        string? expectedProduct,
        string? installedVersion,
        string? offeredVersion,
        CancellationToken cancellationToken)
    {
        if (updateStream is null && string.IsNullOrWhiteSpace(downloadUrl))
            throw new InvalidOperationException("Indica el archivo de actualización o una URL de descarga.");

        AnalysisJob job;
        if (updateStream is not null)
        {
            job = await CreateJobWithPrimaryFileAsync(
                AnalysisSubjectKind.Update,
                updateStream,
                updateFileName ?? "update.bin",
                baselineStream,
                baselineFileName,
                downloadUrl,
                tenantId,
                userId,
                expectedProduct,
                installedVersion,
                offeredVersion,
                cancellationToken);
        }
        else
        {
            if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out var uri))
                throw new InvalidOperationException("URL inválida.");
            if (!UrlSafetyValidator.TryValidate(uri, out var updateUrlError))
                throw new InvalidOperationException(updateUrlError);
            if (!UrlSafetyValidator.LooksLikeDirectFileUrl(uri, out var updateHint))
                throw new InvalidOperationException(updateHint);

            string? baselineStored = null;
            if (baselineStream is not null)
            {
                var baseName = FileNameSanitizer.Sanitize(baselineFileName ?? "installed.bin", _options.MaxFileNameLength);
                baselineStored = await _storage.SaveUploadAsync(baselineStream, baseName, cancellationToken);
            }

            job = new AnalysisJob
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                SubjectKind = AnalysisSubjectKind.Update,
                SourceUrl = uri.ToString(),
                OriginalFileName = "pending-download",
                BaselineStoredFileName = baselineStored,
                ExpectedProduct = TrimProduct(expectedProduct),
                InstalledVersion = TrimVersion(installedVersion),
                OfferedVersion = TrimVersion(offeredVersion),
                Status = AnalysisStatus.Queued
            };

            await _store.AddAsync(job, cancellationToken);
            await _queue.EnqueueAsync(job.Id, cancellationToken);
        }

        return job;
    }

    private async Task<AnalysisJob> CreateJobWithPrimaryFileAsync(
        AnalysisSubjectKind kind,
        Stream primaryStream,
        string primaryName,
        Stream? baselineStream,
        string? baselineName,
        string? sourceUrl,
        string? tenantId,
        string? userId,
        string? expectedProduct,
        string? installedVersion,
        string? offeredVersion,
        CancellationToken cancellationToken)
    {
        var safePrimary = FileNameSanitizer.Sanitize(primaryName, _options.MaxFileNameLength);
        var stored = await _storage.SaveUploadAsync(primaryStream, safePrimary, cancellationToken);
        var size = new FileInfo(_storage.GetFullPath(stored)).Length;

        string? baselineStored = null;
        if (baselineStream is not null)
        {
            var safeBase = FileNameSanitizer.Sanitize(baselineName ?? "installed.bin", _options.MaxFileNameLength);
            baselineStored = await _storage.SaveUploadAsync(baselineStream, safeBase, cancellationToken);
        }

        var job = new AnalysisJob
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            SubjectKind = kind,
            OriginalFileName = safePrimary,
            StoredFileName = stored,
            BaselineStoredFileName = baselineStored,
            SourceUrl = sourceUrl,
            FileSizeBytes = size,
            ExpectedProduct = TrimProduct(expectedProduct),
            InstalledVersion = TrimVersion(installedVersion),
            OfferedVersion = TrimVersion(offeredVersion),
            Status = AnalysisStatus.Queued
        };

        await _store.AddAsync(job, cancellationToken);
        await _queue.EnqueueAsync(job.Id, cancellationToken);
        return job;
    }

    public Task<AnalysisJob?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        _store.GetAsync(id, cancellationToken);

    private static string? TrimProduct(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(500, value.Trim().Length)];

    private static string? TrimVersion(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(50, value.Trim().Length)];
}
