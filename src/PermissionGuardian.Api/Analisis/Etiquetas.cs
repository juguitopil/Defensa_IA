using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Reglas;

public static class Etiquetas
{
    public const int PesoBajo = 5;
    public const int PesoMedio = 16;
    public const int PesoAlto = 30;
    public const int PesoCritico = 54;

    public static int Peso(NivelRiesgo nivel) => nivel switch
    {
        NivelRiesgo.Bajo => PesoBajo,
        NivelRiesgo.Medio => PesoMedio,
        NivelRiesgo.Alto => PesoAlto,
        NivelRiesgo.Critico => PesoCritico,
        _ => PesoMedio
    };

    public static NivelRiesgo Banda(int puntuacion)
    {
        if (puntuacion >= 75) return NivelRiesgo.Critico;
        if (puntuacion >= 45) return NivelRiesgo.Alto;
        if (puntuacion >= 20) return NivelRiesgo.Medio;
        return NivelRiesgo.Bajo;
    }

    public static string Nivel(NivelRiesgo nivel) => nivel switch
    {
        NivelRiesgo.Bajo => "Riesgo bajo",
        NivelRiesgo.Medio => "Riesgo medio",
        NivelRiesgo.Alto => "Riesgo alto",
        NivelRiesgo.Critico => "Riesgo crítico",
        _ => nivel.ToString()
    };

    public static string Coherencia(Coherencia coherencia) => coherencia switch
    {
        Domain.Coherencia.Coherente => "Coherente",
        Domain.Coherencia.Revisar => "Revisar",
        Domain.Coherencia.RiesgoElevado => "Riesgo elevado",
        Domain.Coherencia.AmplioJustificado => "Amplio, justificado",
        _ => coherencia.ToString()
    };

    public static string Proposito(string clave) => clave switch
    {
        "images" => "edición de imágenes",
        "storage" => "almacenamiento propio",
        "ui" => "interfaz",
        "interaction" => "acción iniciada por la persona",
        "documents" => "documentos y descargas",
        "filesystem" => "archivos del equipo",
        "location" => "ubicación",
        "identity" => "identidad",
        "clipboard" => "portapapeles",
        "network_all" => "acceso a cualquier sitio",
        "network_host" => "sitios concretos",
        "browsing" => "actividad de navegación",
        "capture" => "cámara, micrófono o pantalla",
        "control" => "control del navegador",
        "injection" => "inyección de código",
        "desconocido" => "propósito no catalogado",
        _ => clave
    };

    public static string Unir(IEnumerable<string> items)
    {
        var lista = items.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
        return lista.Count switch
        {
            0 => "",
            1 => lista[0],
            2 => $"{lista[0]} y {lista[1]}",
            _ => string.Join(", ", lista.Take(lista.Count - 1)) + " y " + lista[^1]
        };
    }
}
