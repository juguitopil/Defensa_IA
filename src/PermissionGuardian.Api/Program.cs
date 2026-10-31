using Microsoft.EntityFrameworkCore;
using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Data;
using PermissionGuardian.Api.Endpoints;
using PermissionGuardian.Api.Servicios;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<AppDbContext>(opciones =>
    opciones.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddHttpClient<ExplicadorIa>(cliente => cliente.Timeout = TimeSpan.FromSeconds(25));
builder.Services.AddScoped<ServicioAnalisis>();
builder.Services.AddCors(opciones =>
    opciones.AddDefaultPolicy(politica => politica.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();
ApiEndpoints.Map(app);
app.MapFallbackToFile("index.html");

await using (var alcance = app.Services.CreateAsyncScope())
{
    var servicios = alcance.ServiceProvider;
    var db = servicios.GetRequiredService<AppDbContext>();
    var servicio = servicios.GetRequiredService<ServicioAnalisis>();
    var registro = servicios.GetRequiredService<ILoggerFactory>().CreateLogger("Inicio");
    try
    {
        await db.Database.EnsureCreatedAsync();
        await ActualizacionEsquema.AplicarAsync(db);
        await DbSeeder.SembrarAsync(db, servicio);
    }
    catch (Exception ex)
    {
        registro.LogCritical(ex, "No se pudo preparar la base PermissionGuardian en SQL Server.");
        throw;
    }
}

app.Run();
