namespace PermissionGuardian.Api.Domain;

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Correo { get; set; } = "";
    public string Clave { get; set; } = "";
}

public class Aplicacion
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string Categoria { get; set; } = "";
    public string FuncionPrincipal { get; set; } = "";
    public string Desarrollador { get; set; } = "";
    public string? OrigenId { get; set; }
    public bool FuncionConfirmada { get; set; } = true;
    public DateTime? FechaUltimaRevision { get; set; }
    public DateTime FechaRegistro { get; set; }
    public List<VersionAplicacion> Versiones { get; set; } = [];
}

public class VersionAplicacion
{
    public int Id { get; set; }
    public int AplicacionId { get; set; }
    public Aplicacion Aplicacion { get; set; } = null!;
    public string Numero { get; set; } = "";
    public DateTime Fecha { get; set; }
    public List<AplicacionPermiso> Permisos { get; set; } = [];
    public Analisis? Analisis { get; set; }
}

public class Permiso
{
    public int Id { get; set; }
    public string Clave { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string Consecuencia { get; set; } = "";
    public NivelRiesgo NivelRiesgo { get; set; }
    public string Propositos { get; set; } = "";
}

public class AplicacionPermiso
{
    public int Id { get; set; }
    public int VersionAplicacionId { get; set; }
    public VersionAplicacion Version { get; set; } = null!;
    public int PermisoId { get; set; }
    public Permiso Permiso { get; set; } = null!;
}

public class Analisis
{
    public int Id { get; set; }
    public int VersionAplicacionId { get; set; }
    public VersionAplicacion Version { get; set; } = null!;
    public DateTime Fecha { get; set; }
    public int Puntuacion { get; set; }
    public NivelRiesgo NivelRiesgo { get; set; }
    public string Explicacion { get; set; } = "";
    public string ExplicacionReglas { get; set; } = "";
    public string FuenteExplicacion { get; set; } = "reglas";
    public string? AdvertenciaIa { get; set; }
    public string Recomendacion { get; set; } = "";
    public bool CambioImportante { get; set; }
    public List<Alerta> Alertas { get; set; } = [];
}

public class Alerta
{
    public int Id { get; set; }
    public int AnalisisId { get; set; }
    public Analisis Analisis { get; set; } = null!;
    public int PermisoId { get; set; }
    public Permiso Permiso { get; set; } = null!;
    public Coherencia Coherencia { get; set; }
    public string Evidencia { get; set; } = "";
    public string Recomendacion { get; set; } = "";
    public decimal Aporte { get; set; }
    public bool EsAlerta { get; set; }
    public bool EsCambio { get; set; }
}
