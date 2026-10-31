using System.Threading.Channels;
using SafeUpdate.Application.Abstractions;

namespace SafeUpdate.Infrastructure.Queue;

public sealed class ChannelAnalysisQueue : IAnalysisQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateBounded<Guid>(new BoundedChannelOptions(256)
    {
        FullMode = BoundedChannelFullMode.Wait
    });

    public ValueTask EnqueueAsync(Guid jobId, CancellationToken cancellationToken) =>
        _channel.Writer.WriteAsync(jobId, cancellationToken);

    public ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAsync(cancellationToken);
}
