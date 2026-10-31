using System.Net;
using System.Net.Sockets;

namespace SafeUpdate.Application.Services;

public static class UrlSafetyValidator
{
    public static bool TryValidate(Uri url, out string? error)
    {
        error = null;
        if (url.Scheme is not "http" and not "https")
        {
            error = "Solo se permiten URLs http o https.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(url.Host))
        {
            error = "Host inválido.";
            return false;
        }

        if (url.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            url.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
        {
            error = "Host local no permitido.";
            return false;
        }

        if (IPAddress.TryParse(url.Host, out var literal))
        {
            if (IsBlockedIp(literal))
            {
                error = "IP no permitida (red privada/reservada).";
                return false;
            }

            return true;
        }

        return true;
    }

    public static async Task<bool> IsHostSafeAfterDnsAsync(string host, CancellationToken cancellationToken)
    {
        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host, cancellationToken);
            return addresses.Length > 0 && addresses.All(a => !IsBlockedIp(a));
        }
        catch
        {
            return false;
        }
    }

    private static bool IsBlockedIp(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip))
            return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            if (b[0] == 10)
                return true;
            if (b[0] == 127)
                return true;
            if (b[0] == 169 && b[1] == 254)
                return true;
            if (b[0] == 192 && b[1] == 168)
                return true;
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                return true;
            if (b[0] == 0)
                return true;
        }

        if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal)
            return true;

        return false;
    }

    private static readonly HashSet<string> DirectDownloadExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".apk", ".exe", ".msi", ".msix", ".zip", ".jar", ".dmg", ".deb", ".rpm",
        ".pdf", ".docx", ".xlsx", ".bin", ".appx", ".txt"
    };

    private static readonly string[] LandingPageHosts =
    [
        "chatgpt.com", "chat.openai.com", "openai.com",
        "google.com", "www.google.com", "play.google.com",
        "youtube.com", "www.youtube.com",
        "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
        "apps.apple.com", "microsoft.com", "www.microsoft.com"
    ];

    /// <summary>
    /// Heurística: SafeUpdate necesita un enlace al artefacto, no una landing page.
    /// </summary>
    public static bool LooksLikeDirectFileUrl(Uri url, out string? guidance)
    {
        guidance = null;
        if (LandingPageHosts.Any(h => url.Host.Equals(h, StringComparison.OrdinalIgnoreCase) ||
                                      url.Host.EndsWith("." + h, StringComparison.OrdinalIgnoreCase)))
        {
            guidance = $"«{url.Host}» es una página web, no un enlace de descarga. Baja el archivo y úsalo en modo «Archivo», o pega un enlace que termine en .apk/.exe/.msi/.pdf.";
            return false;
        }

        var path = url.AbsolutePath;
        if (string.IsNullOrWhiteSpace(path) || path == "/" || path.EndsWith('/'))
        {
            guidance = "La URL parece una página web. Usa un enlace directo al archivo (.apk, .exe, .msi, .zip, etc.) o sube el archivo en modo «Archivo».";
            return false;
        }

        var ext = Path.GetExtension(path);
        if (string.IsNullOrEmpty(ext))
        {
            guidance = "La URL no tiene extensión de archivo reconocible. Ejemplo válido: https://vendor.com/releases/app-v2.apk";
            return false;
        }

        if (!DirectDownloadExtensions.Contains(ext))
        {
            guidance = $"Extensión «{ext}» no está en la lista de formatos habituales; puedes subir el archivo manualmente si la descarga falla.";
            return true;
        }

        return true;
    }
}
