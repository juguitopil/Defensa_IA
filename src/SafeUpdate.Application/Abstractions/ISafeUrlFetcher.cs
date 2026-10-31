namespace SafeUpdate.Application.Abstractions;

public sealed record SafeDownloadResult(string SuggestedFileName, Stream Content, long? ContentLength);

public interface ISafeUrlFetcher
{
    Task<SafeDownloadResult> DownloadAsync(Uri url, CancellationToken cancellationToken);
}
