using System.Text.RegularExpressions;

namespace SafeUpdate.Application.Services;

public static partial class FileNameSanitizer
{
    public static string Sanitize(string fileName, int maxLength)
    {
        var name = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(name))
            name = "upload.bin";

        name = InvalidChars().Replace(name, "_");
        name = name.Trim('.', ' ');
        if (name.Length > maxLength)
            name = name[..maxLength];

        return string.IsNullOrEmpty(name) ? "upload.bin" : name;
    }

    [GeneratedRegex(@"[<>:""/\\|?*\x00-\x1F]")]
    private static partial Regex InvalidChars();
}
