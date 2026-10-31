using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Reglas;

public static class NarradorEvaluacion
{
    public static string Redactar(string nombre, string enunciadoFuncion, ResultadoReglas resultado)
    {
        var excesivos = resultado.Permisos.Where(p => p.Coherencia == Coherencia.RiesgoElevado).ToList();
        var revisar = resultado.Permisos.Where(p => p.Coherencia == Coherencia.Revisar).ToList();
        var amplios = resultado.Permisos.Where(p => p.Coherencia == Coherencia.AmplioJustificado).ToList();
        var partes = new List<string>
        {
            $"{nombre} declara que su función principal es {enunciadoFuncion}."
        };

        if (resultado.Permisos.Count == 0)
        {
            partes.Add("No se registró ningún permiso, así que no hay un acceso que evaluar.");
        }
        else if (excesivos.Count > 0)
        {
            var detalle = Etiquetas.Unir(excesivos.Select(p => $"{p.Nombre}, que {p.Consecuencia}"));
            partes.Add(
                $"Solicita permisos que no se desprenden de esa función: {detalle}. " +
                "Estos permisos parecen exceder lo necesario. Es un indicio de alcance excesivo, no una prueba de daño.");
        }
        else if (amplios.Count > 0)
        {
            partes.Add(
                $"Solicita permisos amplios que la función sí contempla: {Etiquetas.Unir(amplios.Select(p => p.Nombre))}. " +
                "Que encajen no elimina el riesgo: amplían lo que la aplicación puede alcanzar.");
        }
        else
        {
            partes.Add("Los permisos registrados se relacionan con esa función. No aparecen accesos claramente ajenos al propósito declarado.");
        }

        if (revisar.Count > 0)
        {
            partes.Add(
                $"Conviene revisar {Etiquetas.Unir(revisar.Select(p => p.Nombre))}: " +
                "el vínculo con la función es parcial o el alcance es más amplio de lo que la descripción exige.");
        }

        partes.Add("La puntuación la calcula el motor de reglas, según la sensibilidad de cada permiso y si su propósito encaja con la función. Un modelo de lenguaje, si está conectado, solo redacta.");

        return string.Join(" ", partes);
    }
}
