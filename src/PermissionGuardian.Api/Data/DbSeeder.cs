using Microsoft.EntityFrameworkCore;
using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Contratos;
using PermissionGuardian.Api.Domain;
using PermissionGuardian.Api.Servicios;

namespace PermissionGuardian.Api.Data;

public static class DbSeeder
{
    public static async Task SembrarAsync(AppDbContext db, ServicioAnalisis servicio, CancellationToken ct = default)
    {
        if (await db.Aplicaciones.AnyAsync(ct)) return;

        await using var transaccion = await db.Database.BeginTransactionAsync(ct);

        if (!await db.Permisos.AnyAsync(ct))
        {
            foreach (var definicion in CatalogoPermisos.Todos)
            {
                db.Permisos.Add(new Permiso
                {
                    Clave = definicion.Clave,
                    Nombre = definicion.Nombre,
                    Descripcion = definicion.Descripcion,
                    Consecuencia = definicion.Consecuencia,
                    NivelRiesgo = definicion.Nivel,
                    Propositos = string.Join(',', definicion.Propositos)
                });
            }
        }

        if (!await db.Usuarios.AnyAsync(ct))
        {
            db.Usuarios.Add(new Usuario
            {
                Nombre = "Daniel",
                Correo = "daniel@localhost",
                Clave = HashClave.Derivar("demo")
            });
        }

        await db.SaveChangesAsync(ct);
        await SembrarDemostracionAsync(servicio, ct);
        await transaccion.CommitAsync(ct);
    }

    private static async Task<AplicacionDetalleDto> ExigirAsync(Task<ResultadoOperacion<AplicacionDetalleDto>> operacion)
    {
        var resultado = await operacion;
        if (resultado.Valor is null)
            throw new InvalidOperationException(resultado.Error ?? "No se pudo sembrar la demostración.");
        return resultado.Valor;
    }

    private static async Task SembrarDemostracionAsync(ServicioAnalisis servicio, CancellationToken ct)
    {
        await ExigirAsync(servicio.CrearAsync(App(
            "Notas Claras",
            "Guarda notas cortas en el almacenamiento de la extensión.",
            "Productividad",
            "notas",
            "Cuaderno Studio",
            "1.3",
            ["storage", "activeTab", "contextMenus"]), false, Fecha(2026, 10, 2), ct));

        await ExigirAsync(servicio.CrearAsync(App(
            "Clima de Bolsillo",
            "Muestra el pronóstico del lugar en el que está el dispositivo.",
            "Utilidades",
            "clima",
            "Bruma",
            "3.1",
            ["geolocation", "storage", "notifications"]), false, Fecha(2026, 10, 8), ct));

        await ExigirAsync(servicio.CrearAsync(App(
            "Llave Segura",
            "Completa contraseñas guardadas en los sitios donde la persona tiene una cuenta.",
            "Seguridad",
            "gestor_contrasenas",
            "Bóveda",
            "2.0",
            ["all_urls", "storage", "identity", "clipboardRead"]), false, Fecha(2026, 10, 15), ct));

        await ExigirAsync(servicio.CrearAsync(App(
            "PDF Express Gratis",
            "Convierte documentos a PDF.",
            "Utilidades",
            "pdf",
            "Descargas Rápidas",
            "8.4",
            ["history", "cookies", "all_urls", "clipboardRead", "tabs", "downloads"]), false, Fecha(2026, 10, 21), ct));

        var foto = await ExigirAsync(servicio.CrearAsync(App(
            "Photo Editor",
            "Extensión para editar imágenes seleccionadas por la persona.",
            "Productividad",
            "edicion_imagenes",
            "Taller Lumen",
            "1.0",
            ["images_selected", "storage"]), false, Fecha(2026, 4, 30), ct));

        await ExigirAsync(servicio.AgregarVersionAsync(
            foto.Id,
            new NuevaVersionRequest("2.0", ["images_selected", "storage", "all_urls", "file_urls"]),
            usarIa: false,
            Fecha(2026, 10, 28),
            ct));
    }

    private static CrearAplicacionRequest App(
        string nombre,
        string descripcion,
        string categoria,
        string funcion,
        string desarrollador,
        string version,
        IReadOnlyList<string> permisos) =>
        new(nombre, descripcion, categoria, funcion, desarrollador, version, permisos, null);

    private static DateTime Fecha(int anio, int mes, int dia) =>
        new(anio, mes, dia, 15, 0, 0, DateTimeKind.Utc);
}
