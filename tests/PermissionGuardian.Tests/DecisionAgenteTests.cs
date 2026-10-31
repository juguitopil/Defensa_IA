using PermissionGuardian.Api.Reglas;

namespace PermissionGuardian.Tests;

public class DecisionAgenteTests
{
    [Fact]
    public void Misma_version_y_mismos_permisos_no_abre_otra_version()
    {
        Assert.True(DecisionAgente.SinCambios("1.2", ["storage", "tabs"], "1.2", ["tabs", "storage"]));
    }

    [Fact]
    public void Permisos_distintos_en_la_misma_version_no_son_sin_cambios()
    {
        Assert.False(DecisionAgente.SinCambios("1.2", ["storage"], "1.2", ["storage", "tabs"]));
    }

    [Fact]
    public void Cambia_el_numero_aunque_los_permisos_sigan_igual()
    {
        Assert.False(DecisionAgente.SinCambios("1.2", ["storage"], "1.3", ["storage"]));
    }

    [Fact]
    public void Una_revision_ya_guardada_con_los_mismos_permisos_no_abre_otra()
    {
        Assert.True(DecisionAgente.SinCambios(
            "1.2 · revisión 2",
            ["storage", "tabs"],
            "1.2",
            ["tabs", "storage"]));
    }

    [Fact]
    public void La_version_1_20_no_se_confunde_con_la_1_2()
    {
        Assert.False(DecisionAgente.SinCambios("1.20", ["storage"], "1.2", ["storage"]));
    }

    [Fact]
    public void Numero_libre_se_conserva()
    {
        Assert.Equal("2.0", DecisionAgente.NumeroDisponible(["1.0"], "2.0"));
    }

    [Fact]
    public void Numero_ocupado_recibe_un_sufijo_de_revision()
    {
        var numero = DecisionAgente.NumeroDisponible(["1.2", "1.2 · revisión 2"], "1.2");
        Assert.Equal("1.2 · revisión 3", numero);
    }
}
