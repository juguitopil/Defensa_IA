using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Reglas;

public sealed record PermisoEvaluado(
    string Clave,
    string Nombre,
    string Consecuencia,
    NivelRiesgo Nivel,
    Coherencia Coherencia,
    decimal Aporte,
    string Evidencia,
    string Recomendacion)
{
    public bool EsAlerta => Coherencia != Domain.Coherencia.Coherente;
}

public sealed record ResultadoReglas(
    int Puntuacion,
    NivelRiesgo Nivel,
    IReadOnlyList<PermisoEvaluado> Permisos,
    string Recomendacion);

public static class MotorReglas
{
    public static ResultadoReglas Evaluar(string perfilClave, IEnumerable<string> claves)
    {
        var perfil = PerfilesFuncion.Buscar(perfilClave)
            ?? throw new ArgumentException($"La función «{perfilClave}» no está en el catálogo.");

        var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var evaluaciones = new List<PermisoEvaluado>();
        decimal suma = 0;

        foreach (var clave in claves)
        {
            if (string.IsNullOrWhiteSpace(clave)) continue;
            var definicion = CatalogoPermisos.Resolver(clave);
            if (!vistos.Add(definicion.Clave)) continue;

            var (coherencia, factor) = Clasificar(definicion, perfil);
            var aporte = decimal.Round(Etiquetas.Peso(definicion.Nivel) * factor, 2, MidpointRounding.AwayFromZero);
            suma += aporte;

            evaluaciones.Add(new PermisoEvaluado(
                definicion.Clave,
                definicion.Nombre,
                definicion.Consecuencia,
                definicion.Nivel,
                coherencia,
                aporte,
                Evidencia(definicion, perfil, coherencia),
                RecomendarPermiso(coherencia)));
        }

        var puntuacion = (int)Math.Clamp(
            Math.Round(suma, 0, MidpointRounding.AwayFromZero),
            0,
            100);
        var nivel = Etiquetas.Banda(puntuacion);

        return new ResultadoReglas(puntuacion, nivel, evaluaciones, Recomendar(nivel));
    }

    public static string Recomendar(NivelRiesgo nivel) => nivel switch
    {
        NivelRiesgo.Critico or NivelRiesgo.Alto =>
            "Revisar la necesidad de esos permisos antes de instalarla.",
        NivelRiesgo.Medio =>
            "El acceso es amplio o solo encaja en parte. Revísalo y decide con esa información.",
        _ =>
            "No se observaron permisos claramente ajenos a la función declarada. Concede solo lo que estés dispuesto a compartir."
    };

    private static (Coherencia Coherencia, decimal Factor) Clasificar(DefinicionPermiso permiso, PerfilFuncion perfil)
    {
        if (Contiene(permiso.Propositos, perfil.Esperados))
        {
            var sensible = permiso.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico;
            return (Coherencia.Coherente, sensible ? 0.22m : 0.10m);
        }

        if (Contiene(permiso.Propositos, perfil.Amplios))
        {
            var sensible = permiso.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico;
            return sensible
                ? (Coherencia.AmplioJustificado, 0.38m)
                : (Coherencia.Coherente, 0.10m);
        }

        if (Contiene(permiso.Propositos, perfil.Relacionados))
            return (Coherencia.Revisar, 0.75m);

        if (permiso.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico)
            return (Coherencia.RiesgoElevado, 1.00m);

        return (Coherencia.Revisar, 0.75m);
    }

    private static string Evidencia(DefinicionPermiso permiso, PerfilFuncion perfil, Coherencia coherencia)
    {
        var consecuencia = $"Consecuencia: {permiso.Consecuencia}.";
        var funcion = perfil.Enunciado;

        return coherencia switch
        {
            Coherencia.Coherente => Coherente(permiso, perfil, funcion, consecuencia),
            Coherencia.AmplioJustificado =>
                $"La función «{funcion}» contempla este acceso amplio ({Propositos(permiso, perfil.Amplios)}). {consecuencia} Que encaje con la función no acredita confianza: sí aumenta la superficie de acceso.",
            Coherencia.Revisar when Contiene(permiso.Propositos, perfil.Relacionados) =>
                $"Se relaciona de forma parcial con «{funcion}» por «{Propositos(permiso, perfil.Relacionados)}», pero el alcance es mayor que el de la función declarada. {consecuencia}",
            Coherencia.Revisar =>
                $"No aparece entre lo que «{funcion}» necesita ({Propositos(permiso, permiso.Propositos)}). La sensibilidad no es la más alta, y aun así conviene preguntar por qué está. {consecuencia}",
            _ =>
                $"Ningún propósito de este permiso ({Propositos(permiso, permiso.Propositos)}) forma parte de lo que «{funcion}» necesita. {consecuencia}"
        };
    }

    private static string Coherente(DefinicionPermiso permiso, PerfilFuncion perfil, string funcion, string consecuencia)
    {
        var bolsa = Contiene(permiso.Propositos, perfil.Esperados) ? perfil.Esperados : perfil.Amplios;
        var motivo = Propositos(permiso, bolsa);
        var sensible = permiso.Nivel is NivelRiesgo.Alto or NivelRiesgo.Critico
            ? " Es un permiso sensible y, en este caso, está ligado a la función."
            : "";
        return $"Encaja con «{funcion}» por «{motivo}».{sensible} {consecuencia}";
    }

    private static string RecomendarPermiso(Coherencia coherencia) => coherencia switch
    {
        Coherencia.Coherente => "Puede aceptarse si estás de acuerdo con la consecuencia descrita.",
        Coherencia.Revisar => "Pregunta por qué hace falta este alcance antes de aceptarlo.",
        Coherencia.RiesgoElevado => "No lo concedas hasta entender por qué una aplicación con esta función lo necesita.",
        Coherencia.AmplioJustificado => "Encaja con la función. Concédelo solo si confías en quien publica la aplicación.",
        _ => "Revisa este permiso con calma."
    };

    private static bool Contiene(IEnumerable<string> propositos, IReadOnlyCollection<string> bolsa) =>
        propositos.Any(bolsa.Contains);

    private static string Propositos(DefinicionPermiso permiso, IReadOnlyCollection<string> bolsa)
    {
        var coinciden = permiso.Propositos.Where(bolsa.Contains).Select(Etiquetas.Proposito).ToList();
        var origen = coinciden.Count > 0 ? coinciden : permiso.Propositos.Select(Etiquetas.Proposito);
        return Etiquetas.Unir(origen);
    }
}
