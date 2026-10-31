using System.Net;
using Microsoft.Extensions.Options;
using SafeUpdate.Application.Abstractions;
using SafeUpdate.Application.Options;
using SafeUpdate.Application.Services;

namespace SafeUpdate.Infrastructure.Network;

public sealed class SafeUrlFetcher : ISafeUrlFetcher
{
    private readonly SafeUpdateOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    public SafeUrlFetcher(IHttpClientFactory httpClientFactory, IOptions<SafeUpdateOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    public async Task<SafeDownloadResult> DownloadAsync(Uri url, CancellationToken cancellationToken)
    {
        if (!_options.AllowUrlDownload)
            throw new InvalidOperationException("Descarga por URL deshabilitada en este entorno.");

        if (!UrlSafetyValidator.TryValidate(url, out var validationError))
            throw new InvalidOperationException(validationError);

        if (!await UrlSafetyValidator.IsHostSafeAfterDnsAsync(url.Host, cancellationToken))
            throw new InvalidOperationException("El host resuelve a una red no permitida (protección SSRF).");

        var client = _httpClientFactory.CreateClient("SafeUpdateFetcher");
        var current = url;
        for (var redirect = 0; redirect <= _options.MaxUrlRedirects; redirect++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, current);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if ((int)response.StatusCode is >= 300 and <= 399 &&
                response.Headers.Location is { } location)
            {
                current = location.IsAbsoluteUri ? location : new Uri(current, location);
                if (!UrlSafetyValidator.TryValidate(current, out validationError))
                    throw new InvalidOperationException(validationError);
                if (!await UrlSafetyValidator.IsHostSafeAfterDnsAsync(current.Host, cancellationToken))
                    throw new InvalidOperationException("Redirección apunta a red no permitida.");
                continue;
            }

            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException(DescribeHttpError(response.StatusCode, current));

            if (response.Content.Headers.ContentLength > _options.MaxUploadBytes)
                throw new InvalidOperationException("El archivo remoto excede el tamaño máximo permitido.");

            await using var remote = await response.Content.ReadAsStreamAsync(cancellationToken);
            var copy = new MemoryStream();
            var buffer = new byte[81920];
            long total = 0;
            int read;
            while ((read = await remote.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
            {
                total += read;
                if (total > _options.MaxUploadBytes)
                    throw new InvalidOperationException("El archivo remoto excede el tamaño máximo permitido.");
                await copy.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }

            if (total == 0)
                throw new InvalidOperationException("La descarga no trajo contenido. Usa un enlace directo al archivo o súbelo en modo «Archivo».");

            copy.Position = 0;
            var name = GuessFileName(current, response);
            return new SafeDownloadResult(name, copy, total);
        }

        throw new InvalidOperationException("Demasiadas redirecciones HTTP.");
    }

    private static string DescribeHttpError(HttpStatusCode code, Uri url) => (int)code switch
    {
        403 => $"El sitio rechazó la descarga automática (403 Forbidden): {url.Host}. " +
               "Es habitual en páginas como ChatGPT, Google Drive sin enlace directo, etc. " +
               "Descarga el archivo en tu PC y úsalo en modo «Archivo», o pega un enlace directo al .apk/.exe/.msi.",
        404 => $"Archivo no encontrado (404) en {url}.",
        401 => "Se requiere autenticación (401); este analizador no puede iniciar sesión en sitios web.",
        _ => $"No se pudo descargar ({(int)code} {code}) desde {url}."
    };

    private static string GuessFileName(Uri uri, HttpResponseMessage response)
    {
        var cd = response.Content.Headers.ContentDisposition?.FileName?.Trim('"');
        if (!string.IsNullOrWhiteSpace(cd))
            return cd;
        var path = uri.AbsolutePath;
        var file = Path.GetFileName(path);
        return string.IsNullOrWhiteSpace(file) ? "download.bin" : file;
    }
}
