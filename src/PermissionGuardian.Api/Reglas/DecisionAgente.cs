namespace PermissionGuardian.Api.Reglas;

public static class DecisionAgente
{
    public static bool SinCambios(
        string versionGuardada,
        IEnumerable<string> permisosGuardados,
        string versionEntrante,
        IEnumerable<string> permisosEntrantes)
    {
        if (!MismaLinea(versionGuardada, versionEntrante))
            return false;

        var guardados = new HashSet<string>(permisosGuardados, StringComparer.OrdinalIgnoreCase);
        var entrantes = new HashSet<string>(permisosEntrantes, StringComparer.OrdinalIgnoreCase);
        return guardados.SetEquals(entrantes);
    }

    public static string NumeroDisponible(IEnumerable<string> existentes, string deseado)
    {
        var usados = new HashSet<string>(existentes, StringComparer.OrdinalIgnoreCase);
        var baseNumero = deseado.Trim();
        if (baseNumero.Length > 60)
            baseNumero = baseNumero[..60].TrimEnd();
        if (baseNumero.Length == 0)
            baseNumero = "sin-numero";

        if (usados.Add(baseNumero))
            return baseNumero;

        for (var n = 2; n < 100; n++)
        {
            var candidato = $"{baseNumero} · revisión {n}";
            if (usados.Add(candidato))
                return candidato;
        }

        var marca = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var reserva = $"{baseNumero[..Math.Min(50, baseNumero.Length)]} · {marca}";
        return reserva.Length <= 80 ? reserva : reserva[..80];
    }

    private static bool MismaLinea(string versionGuardada, string versionEntrante)
    {
        var guardada = versionGuardada.Trim();
        var entrante = versionEntrante.Trim();
        if (guardada.Equals(entrante, StringComparison.OrdinalIgnoreCase))
            return true;

        return guardada.StartsWith(entrante + " · revisión ", StringComparison.OrdinalIgnoreCase);
    }
}
