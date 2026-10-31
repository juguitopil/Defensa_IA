namespace PermissionGuardian.Api.Contratos;

public sealed record CrearAplicacionRequest(
    string? Nombre,
    string? Descripcion,
    string? Categoria,
    string? FuncionPrincipal,
    string? Desarrollador,
    string? Version,
    IReadOnlyList<string>? Permisos,
    string? OrigenId);

public sealed record NuevaVersionRequest(
    string? Version,
    IReadOnlyList<string>? Permisos);

public sealed record ImportarExtensionRequest(
    string? Nombre,
    string? Descripcion,
    string? Desarrollador,
    string? Version,
    string? FuncionPrincipal,
    string? OrigenId,
    IReadOnlyList<string>? Permisos);

public sealed record PermisoDto(
    string Clave,
    string Nombre,
    string Descripcion,
    string Consecuencia,
    string NivelRiesgo,
    string NivelEtiqueta,
    IReadOnlyList<string> Propositos);

public sealed record PerfilDto(
    string Clave,
    string Titulo,
    string Enunciado,
    string Descripcion,
    IReadOnlyList<string> SueleNecesitar);

public sealed record AplicacionResumenDto(
    int Id,
    string Nombre,
    string Descripcion,
    string Categoria,
    string FuncionPrincipal,
    string FuncionTitulo,
    string Desarrollador,
    string VersionActual,
    int VersionId,
    int Puntuacion,
    string NivelRiesgo,
    string NivelEtiqueta,
    int Alertas,
    bool CambioImportante,
    DateTime FechaAnalisis,
    bool FuncionConfirmada,
    DateTime? FechaUltimaRevision);

public sealed record AplicacionDetalleDto(
    int Id,
    string Nombre,
    string Descripcion,
    string Categoria,
    string FuncionPrincipal,
    string FuncionTitulo,
    string FuncionEnunciado,
    string Desarrollador,
    DateTime FechaRegistro,
    IReadOnlyList<VersionDto> Versiones,
    bool FuncionConfirmada,
    DateTime? FechaUltimaRevision);

public sealed record VersionDto(
    int Id,
    string Numero,
    DateTime Fecha,
    IReadOnlyList<string> Permisos,
    AnalisisDto? Analisis);

public sealed record AnalisisDto(
    int Id,
    DateTime Fecha,
    int Puntuacion,
    string NivelRiesgo,
    string NivelEtiqueta,
    string Explicacion,
    string ExplicacionReglas,
    string FuenteExplicacion,
    string? AdvertenciaIa,
    string Recomendacion,
    bool CambioImportante,
    IReadOnlyList<HallazgoDto> Hallazgos);

public sealed record HallazgoDto(
    string Clave,
    string Nombre,
    string NivelRiesgo,
    string NivelEtiqueta,
    string Coherencia,
    string CoherenciaEtiqueta,
    decimal Aporte,
    string Evidencia,
    string Recomendacion,
    bool EsAlerta,
    bool EsCambio);

public sealed record HistorialDto(
    int AnalisisId,
    int AplicacionId,
    string Nombre,
    string Version,
    DateTime Fecha,
    int Puntuacion,
    string NivelRiesgo,
    string NivelEtiqueta,
    bool CambioImportante,
    string FuenteExplicacion);

public sealed record ComparacionDto(
    int AplicacionId,
    string Nombre,
    VersionPuntuacionDto Origen,
    VersionPuntuacionDto Destino,
    int Delta,
    bool CambioImportante,
    string Explicacion,
    IReadOnlyList<FilaComparacionDto> Filas);

public sealed record VersionPuntuacionDto(
    int Id,
    string Numero,
    int Puntuacion,
    string NivelRiesgo,
    string NivelEtiqueta);

public sealed record FilaComparacionDto(
    string Clave,
    string Nombre,
    string NivelRiesgo,
    string NivelEtiqueta,
    string Estado);

public sealed record ConfirmarFuncionRequest(string? FuncionPrincipal);

public sealed record RevisionAgenteRequest(IReadOnlyList<ExtensionInstaladaRequest>? Extensiones);

public sealed record ExtensionInstaladaRequest(
    string? OrigenId,
    string? Nombre,
    string? Descripcion,
    string? Desarrollador,
    string? Version,
    IReadOnlyList<string>? Permisos);

public sealed record ResultadoAgenteDto(
    DateTime Fecha,
    IReadOnlyList<RevisionExtensionDto> Revisiones,
    IReadOnlyList<string> YaNoInstaladas);

public sealed record RevisionExtensionDto(
    string OrigenId,
    string Nombre,
    string Accion,
    int? AplicacionId,
    int? Puntuacion,
    string? NivelEtiqueta,
    bool FuncionConfirmada,
    string Mensaje);

public sealed record ResultadoOperacion<T>(T? Valor, string? Error, int Status) where T : class
{
    public static ResultadoOperacion<T> Ok(T valor) => new(valor, null, 200);
    public static ResultadoOperacion<T> Creado(T valor) => new(valor, null, 201);
    public static ResultadoOperacion<T> Fallo(string error, int status) => new(null, error, status);
}
