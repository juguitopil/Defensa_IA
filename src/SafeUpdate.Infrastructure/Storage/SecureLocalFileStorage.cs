using Microsoft.Extensions.Options;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Application.Options;

namespace SafeUpdate.Infrastructure.Storage;

public sealed class SecureLocalFileStorage : ISecureFileStorage
{
    private readonly SafeUpdateOptions _options;
    private readonly string _rootFullPath;

    public SecureLocalFileStorage(IOptions<SafeUpdateOptions> options)
    {
        _options = options.Value;
        _rootFullPath = Path.GetFullPath(_options.UploadRoot);
        Directory.CreateDirectory(_rootFullPath);
    }

    public async Task<string> SaveUploadAsync(Stream content, string sanitizedFileName, CancellationToken cancellationToken)
    {
        var storedFileName = $"{Guid.NewGuid():N}_{sanitizedFileName}";
        var fullPath = GetFullPath(storedFileName);
        EnsureUnderRoot(fullPath);

        await using var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        var buffer = new byte[81920];
        long total = 0;
        int read;
        while ((read = await content.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
        {
            total += read;
            if (total > _options.MaxUploadBytes)
            {
                fs.Close();
                File.Delete(fullPath);
                throw new InvalidOperationException($"Archivo excede el límite de {_options.MaxUploadBytes} bytes.");
            }

            await fs.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        return storedFileName;
    }

    public string GetFullPath(string storedFileName)
    {
        var safe = Path.GetFileName(storedFileName);
        var full = Path.GetFullPath(Path.Combine(_rootFullPath, safe));
        EnsureUnderRoot(full);
        return full;
    }

    public Task DeleteAsync(string storedFileName, CancellationToken cancellationToken)
    {
        var full = GetFullPath(storedFileName);
        if (File.Exists(full))
            File.Delete(full);
        return Task.CompletedTask;
    }

    private void EnsureUnderRoot(string fullPath)
    {
        if (!fullPath.StartsWith(_rootFullPath, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Ruta de almacenamiento inválida.");
    }
}
