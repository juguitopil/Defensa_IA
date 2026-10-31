namespace SafeUpdate.Application.Abstractions;

public interface ISecureFileStorage
{
    Task<string> SaveUploadAsync(Stream content, string sanitizedFileName, CancellationToken cancellationToken);
    string GetFullPath(string storedFileName);
    Task DeleteAsync(string storedFileName, CancellationToken cancellationToken);
}
