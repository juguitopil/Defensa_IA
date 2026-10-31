using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PermissionGuardian.Api.Data;

public class DisenoDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var opciones = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=localhost;Database=PermissionGuardian;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        return new AppDbContext(opciones);
    }
}
