using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Reglas;

public sealed record FilaComparacion(string Clave, string Nombre, NivelRiesgo Nivel, string Estado);

public sealed record ResultadoComparacion(
    int PuntuacionOrigen,
    NivelRiesgo NivelOrigen,
    int PuntuacionDestino,
    NivelRiesgo NivelDestino,
    int Delta,
    bool CambioImportante,
    string Explicacion,
    IReadOnlyList<FilaComparacion> Filas);

public static class ComparadorVersiones
{
    public static ResultadoComparacion Comparar(
        string numeroOrigen,
        string numeroDestino,
        ResultadoReglas origen,
        ResultadoReglas destino)
    {
        var filas = new List<FilaComparacion>();
        foreach (var permiso in origen.Permisos)
        {
            var sigue = destino.Permisos.Any(p => MismaClave(p.Clave, permiso.Clave));
            filas.Add(new FilaComparacion(permiso.Clave, permiso.Nombre, permiso.Nivel, sigue ? "se_mantiene" : "retirado"));
        }

        foreach (var permiso in destino.Permisos)
        {
            if (origen.Permisos.All(p => !MismaClave(p.Clave, permiso.Clave)))
                filas.Add(new FilaComparacion(permiso.Clave, permiso.Nombre, permiso.Nivel, "nuevo"));
        }

        var nuevosSensibles = filas
            .Where(f => f.Estado == "nuevo" && f.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico)
            .ToList();
        var delta = destino.Puntuacion - origen.Puntuacion;
        var importante = nuevosSensibles.Count > 0 || delta >= 20;

        return new ResultadoComparacion(
            origen.Puntuacion,
            origen.Nivel,
            destino.Puntuacion,
            destino.Nivel,
            delta,
            importante,
            Explicar(numeroOrigen, numeroDestino, origen, destino, nuevosSensibles, filas, delta, importante),
            filas);
    }

    public static bool EsCambio(PermisoEvaluado permiso, IEnumerable<string> clavesAnteriores)
    {
        var anteriores = clavesAnteriores as ICollection<string> ?? clavesAnteriores.ToList();
        if (anteriores.Count == 0) return false;
        return anteriores.All(c => !c.Equals(permiso.Clave, StringComparison.OrdinalIgnoreCase))
            && permiso.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico;
    }

    private static string Explicar(
        string numeroOrigen,
        string numeroDestino,
        ResultadoReglas origen,
        ResultadoReglas destino,
        IReadOnlyList<FilaComparacion> nuevosSensibles,
        IReadOnlyList<FilaComparacion> filas,
        int delta,
        bool importante)
    {
        var hayNuevos = filas.Any(f => f.Estado == "nuevo");
        var hayRetirados = filas.Any(f => f.Estado == "retirado");
        var movimiento =
            $"La puntuación pasa de {origen.Puntuacion} ({Etiquetas.Nivel(origen.Nivel).ToLowerInvariant()}) " +
            $"en la versión {numeroOrigen} a {destino.Puntuacion} ({Etiquetas.Nivel(destino.Nivel).ToLowerInvariant()}) " +
            $"en la versión {numeroDestino}.";

        if (!hayNuevos && !hayRetirados)
            return $"No hay cambios de permisos entre la versión {numeroOrigen} y la {numeroDestino}. {movimiento}";

        if (importante && nuevosSensibles.Count > 0)
        {
            var aviso = nuevosSensibles.Count == 1
                ? $"Se detectó un permiso adicional que amplía considerablemente el acceso: {nuevosSensibles[0].Nombre}."
                : $"Se detectaron permisos adicionales que amplían considerablemente el acceso: {Etiquetas.Unir(nuevosSensibles.Select(f => f.Nombre))}.";
            return $"{aviso} {movimiento} Se recomienda investigar el motivo del cambio.";
        }

        if (delta >= 20)
            return $"El conjunto de permisos cambia y el riesgo sube de forma clara. {movimiento} Se recomienda investigar el motivo del cambio.";

        if (hayRetirados && !hayNuevos)
            return $"La versión {numeroDestino} retira permisos que estaban en la {numeroOrigen}. {movimiento}";

        return $"Hay cambios de permisos entre las dos versiones. {movimiento}";
    }

    private static bool MismaClave(string a, string b) =>
        a.Equals(b, StringComparison.OrdinalIgnoreCase);
}
