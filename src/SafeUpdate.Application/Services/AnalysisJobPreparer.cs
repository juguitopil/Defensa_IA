using SafeUpdate.Application.Abstractions;
using SafeUpdate.Domain.Models;

namespace SafeUpdate.Application.Services;

public sealed class AnalysisJobPreparer(
    ISecureFileStorage storage,
    ISafeUrlFetcher urlFetcher)
{
    public async Task EnsureArtifactsAsync(AnalysisJob job, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(job.StoredFileName))
            return;

        if (string.IsNullOrWhiteSpace(job.SourceUrl))
            throw new InvalidOperationException("No hay archivo ni URL de descarga para analizar.");

        if (!Uri.TryCreate(job.SourceUrl, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("URL de descarga inválida.");

        var download = await urlFetcher.DownloadAsync(uri, cancellationToken);
        await using (download.Content)
        {
            job.StoredFileName = await storage.SaveUploadAsync(download.Content, download.SuggestedFileName, cancellationToken);
        }

        var path = storage.GetFullPath(job.StoredFileName);
        job.FileSizeBytes = new FileInfo(path).Length;
        if (job.FileSizeBytes == 0)
            throw new InvalidOperationException("La descarga no trajo contenido. Usa un enlace directo al archivo o súbelo en modo «Archivo».");
        if (string.IsNullOrWhiteSpace(job.OriginalFileName) || job.OriginalFileName == "pending-download")
            job.OriginalFileName = Path.GetFileName(job.StoredFileName);
    }
}
