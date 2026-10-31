using SafeUpdate.Application.Services;
using Xunit;

namespace SafeUpdate.Application.Tests;

public class FileNameSanitizerTests
{
    [Fact]
    public void Strips_path_traversal()
    {
        var name = FileNameSanitizer.Sanitize(@"..\..\etc\passwd", 200);
        Assert.Equal("passwd", name);
        Assert.DoesNotContain("..", name);
    }

    [Fact]
    public void Replaces_invalid_characters()
    {
        var name = FileNameSanitizer.Sanitize("bad<file>.exe", 200);
        Assert.DoesNotContain("<", name);
        Assert.DoesNotContain(">", name);
    }
}
