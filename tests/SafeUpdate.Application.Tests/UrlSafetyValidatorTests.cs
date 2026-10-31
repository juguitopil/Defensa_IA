using SafeUpdate.Application.Services;
using Xunit;

namespace SafeUpdate.Application.Tests;

public class UrlSafetyValidatorTests
{
    [Fact]
    public void Rejects_chatgpt_landing_page()
    {
        var uri = new Uri("https://chatgpt.com/c/68e419d86");
        Assert.False(UrlSafetyValidator.LooksLikeDirectFileUrl(uri, out var guidance));
        Assert.Contains("página web", guidance, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Accepts_direct_apk_link()
    {
        var uri = new Uri("https://vendor.example/releases/app-v2.apk");
        Assert.True(UrlSafetyValidator.LooksLikeDirectFileUrl(uri, out _));
    }

    [Fact]
    public void Blocks_loopback_ip()
    {
        var uri = new Uri("http://127.0.0.1/malware.bin");
        Assert.False(UrlSafetyValidator.TryValidate(uri, out var error));
        Assert.Contains("IP no permitida", error);
    }
}
