using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Tests;

public class NarradorYComparadorTests
{
    [Fact]
    public void La_explicacion_habla_de_alcance_y_no_de_malware()
    {
        var resultado = MotorReglas.Evaluar(
            "edicion_imagenes",
            ["images_selected", "storage", "all_urls", "file_urls"]);
        var texto = NarradorEvaluacion.Redactar("Photo Editor", "editar imágenes", resultado);

        Assert.Contains("editar imágenes", texto);
        Assert.Contains("Leer y modificar todos los sitios web", texto);
        Assert.Contains("indicio de alcance excesivo", texto);
        Assert.DoesNotContain("malware", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("maliciosa", texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void La_comparacion_detecta_el_permiso_nuevo_de_Photo_Editor()
    {
        var origen = MotorReglas.Evaluar("edicion_imagenes", ["images_selected", "storage"]);
        var destino = MotorReglas.Evaluar(
            "edicion_imagenes",
            ["images_selected", "storage", "all_urls", "file_urls"]);

        var comparacion = ComparadorVersiones.Comparar("1.0", "2.0", origen, destino);

        Assert.True(comparacion.CambioImportante);
        Assert.Equal(77, comparacion.Delta);
        Assert.Contains("Se detectaron permisos adicionales", comparacion.Explicacion);
        Assert.Contains("Leer y modificar todos los sitios web", comparacion.Explicacion);
        Assert.Contains("Acceso a todos los archivos", comparacion.Explicacion);
        Assert.Equal("nuevo", comparacion.Filas.Single(f => f.Clave == "all_urls").Estado);
        Assert.Equal("se_mantiene", comparacion.Filas.Single(f => f.Clave == "storage").Estado);
        Assert.Equal(NivelRiesgo.Bajo, comparacion.NivelOrigen);
        Assert.Equal(NivelRiesgo.Critico, comparacion.NivelDestino);
    }
}
