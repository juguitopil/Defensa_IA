using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Contratos;
using PermissionGuardian.Api.Data;
using PermissionGuardian.Api.Servicios;
using Microsoft.EntityFrameworkCore;

namespace PermissionGuardian.Api.Endpoints;

public static class ApiEndpoints
{
    public static void Map(WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/salud", async (AppDbContext db, ExplicadorIa ia, CancellationToken ct) =>
        {
            var conectada = await db.Database.CanConnectAsync(ct);
            return Results.Ok(new
            {
                estado = conectada ? "ok" : "sin-base",
                iaConfigurada = ia.EstaConfigurada
            });
        });

        api.MapGet("/permisos", () =>
            CatalogoPermisos.Todos.Select(p => new PermisoDto(
                p.Clave,
                p.Nombre,
                p.Descripcion,
                p.Consecuencia,
                p.Nivel.ToString(),
                Etiquetas.Nivel(p.Nivel),
                p.Propositos.Select(Etiquetas.Proposito).ToList())));

        api.MapGet("/perfiles", () =>
            PerfilesFuncion.Todos.Select(p => new PerfilDto(
                p.Clave,
                p.Titulo,
                p.Enunciado,
                p.Descripcion,
                p.Esperados.Select(Etiquetas.Proposito).ToList())));

        api.MapGet("/metodologia", () => new
        {
            pesos = new
            {
                bajo = Etiquetas.PesoBajo,
                medio = Etiquetas.PesoMedio,
                alto = Etiquetas.PesoAlto,
                critico = Etiquetas.PesoCritico
            },
            texto =
                "Cada permiso tiene un peso según su sensibilidad: bajo 5, medio 16, alto 30 y crítico 54. " +
                "Si encaja con la función, ese peso se multiplica por 0,10, o por 0,22 si además es sensible. " +
                "Si es amplio y la función lo contempla, se multiplica por 0,38. " +
                "Si la relación es parcial, por 0,75. Si es sensible y no encaja, cuenta entero. " +
                "La suma se redondea y no pasa de 100. " +
                "De 0 a 19 el riesgo es bajo, de 20 a 44 medio, de 45 a 74 alto y de 75 a 100 crítico. " +
                "La puntuación mide permisos difíciles de justificar. No decide que una aplicación sea dañina."
        });

        api.MapGet("/aplicaciones", async (ServicioAnalisis servicio, CancellationToken ct) =>
            Results.Ok(await servicio.ListarAsync(ct)));

        api.MapGet("/aplicaciones/{id:int}", async (int id, ServicioAnalisis servicio, CancellationToken ct) =>
        {
            var detalle = await servicio.ObtenerAsync(id, ct);
            return detalle is null
                ? Results.Problem(title: "No se encontró la aplicación.", statusCode: 404)
                : Results.Ok(detalle);
        });

        api.MapPost("/aplicaciones", async (CrearAplicacionRequest solicitud, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.CrearAsync(solicitud, usarIa: true, fecha: null, ct)));

        api.MapPost("/aplicaciones/{id:int}/versiones", async (int id, NuevaVersionRequest solicitud, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.AgregarVersionAsync(id, solicitud, usarIa: true, fecha: null, ct)));

        api.MapGet("/aplicaciones/{id:int}/comparar", async (int id, int origen, int destino, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.CompararAsync(id, origen, destino, ct)));

        api.MapGet("/analisis", async (ServicioAnalisis servicio, CancellationToken ct) =>
            Results.Ok(await servicio.HistorialAsync(ct)));

        api.MapPost("/importaciones", async (ImportarExtensionRequest solicitud, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.ImportarAsync(solicitud, ct)));

        api.MapPost("/aplicaciones/{id:int}/funcion", async (int id, ConfirmarFuncionRequest solicitud, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.ConfirmarFuncionAsync(id, solicitud.FuncionPrincipal, ct)));

        api.MapPost("/agente/reevaluar", async (RevisionAgenteRequest solicitud, ServicioAnalisis servicio, CancellationToken ct) =>
            Responder(await servicio.ReevaluarAsync(solicitud.Extensiones, ct)));
    }

    private static IResult Responder<T>(ResultadoOperacion<T> resultado) where T : class
    {
        if (resultado.Valor is null)
            return Results.Problem(title: resultado.Error ?? "No se pudo completar la operación.", statusCode: resultado.Status);

        if (resultado.Status == 201 && resultado.Valor is AplicacionDetalleDto detalle)
            return Results.Created($"/api/aplicaciones/{detalle.Id}", detalle);

        return Results.Ok(resultado.Valor);
    }
}
