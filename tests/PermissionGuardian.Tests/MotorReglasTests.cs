using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Tests;

public class MotorReglasTests
{
    [Fact]
    public void PhotoEditor_v2_reproduce_el_ejemplo()
    {
        var resultado = MotorReglas.Evaluar(
            "edicion_imagenes",
            ["images_selected", "storage", "all_urls", "file_urls"]);

        Assert.Equal(78, resultado.Puntuacion);
        Assert.Equal(NivelRiesgo.Critico, resultado.Nivel);
        Assert.Equal(Coherencia.Coherente, Hallazgo(resultado, "images_selected").Coherencia);
        Assert.Equal(Coherencia.RiesgoElevado, Hallazgo(resultado, "all_urls").Coherencia);
        Assert.Equal(Coherencia.Revisar, Hallazgo(resultado, "file_urls").Coherencia);
        Assert.Equal("Revisar la necesidad de esos permisos antes de instalarla.", resultado.Recomendacion);
    }

    [Fact]
    public void PhotoEditor_v1_queda_en_riesgo_bajo()
    {
        var resultado = MotorReglas.Evaluar("edicion_imagenes", ["images_selected", "storage"]);

        Assert.Equal(1, resultado.Puntuacion);
        Assert.Equal(NivelRiesgo.Bajo, resultado.Nivel);
        Assert.All(resultado.Permisos, p => Assert.Equal(Coherencia.Coherente, p.Coherencia));
    }

    [Fact]
    public void Gestor_de_contrasenas_no_trata_el_acceso_amplio_como_exceso()
    {
        var resultado = MotorReglas.Evaluar(
            "gestor_contrasenas",
            ["all_urls", "storage", "identity", "clipboardRead"]);

        Assert.Equal(29, resultado.Puntuacion);
        Assert.Equal(NivelRiesgo.Medio, resultado.Nivel);
        Assert.Equal(Coherencia.AmplioJustificado, Hallazgo(resultado, "all_urls").Coherencia);
        Assert.Equal(Coherencia.Coherente, Hallazgo(resultado, "clipboardRead").Coherencia);
    }

    [Fact]
    public void Pdf_con_permisos_ajenos_llega_al_tope()
    {
        var resultado = MotorReglas.Evaluar(
            "pdf",
            ["history", "cookies", "all_urls", "clipboardRead", "tabs", "downloads"]);

        Assert.Equal(100, resultado.Puntuacion);
        Assert.Equal(NivelRiesgo.Critico, resultado.Nivel);
        Assert.Equal(Coherencia.RiesgoElevado, Hallazgo(resultado, "history").Coherencia);
        Assert.Equal(Coherencia.Coherente, Hallazgo(resultado, "downloads").Coherencia);
    }

    [Fact]
    public void Clima_acepta_la_ubicacion_como_parte_de_la_funcion()
    {
        var resultado = MotorReglas.Evaluar("clima", ["geolocation", "storage", "notifications"]);

        Assert.Equal(8, resultado.Puntuacion);
        Assert.Equal(NivelRiesgo.Bajo, resultado.Nivel);
        Assert.Equal(Coherencia.Coherente, Hallazgo(resultado, "geolocation").Coherencia);
    }

    [Fact]
    public void La_suma_de_aportes_se_redondea_a_la_puntuacion()
    {
        var resultado = MotorReglas.Evaluar(
            "edicion_imagenes",
            ["images_selected", "storage", "all_urls", "file_urls"]);

        var suma = resultado.Permisos.Sum(p => p.Aporte);
        Assert.Equal(77.5m, suma);
        Assert.Equal(78, (int)Math.Round(suma, 0, MidpointRounding.AwayFromZero));
    }

    [Fact]
    public void Un_permiso_desconocido_queda_en_revision()
    {
        var resultado = MotorReglas.Evaluar("notas", ["permisoInventado"]);
        var hallazgo = Assert.Single(resultado.Permisos);
        Assert.Equal(Coherencia.Revisar, hallazgo.Coherencia);
        Assert.Equal(NivelRiesgo.Medio, hallazgo.Nivel);
    }

    [Fact]
    public void La_primera_version_no_marca_cambios()
    {
        var resultado = MotorReglas.Evaluar("pdf", ["all_urls", "history"]);
        Assert.All(resultado.Permisos, p => Assert.False(ComparadorVersiones.EsCambio(p, [])));
    }

    private static PermisoEvaluado Hallazgo(ResultadoReglas resultado, string clave) =>
        resultado.Permisos.Single(p => p.Clave == clave);
}
