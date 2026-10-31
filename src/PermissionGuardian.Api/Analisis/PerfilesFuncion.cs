namespace PermissionGuardian.Api.Reglas;

public sealed record PerfilFuncion(
    string Clave,
    string Titulo,
    string Enunciado,
    string Descripcion,
    string[] Esperados,
    string[] Relacionados,
    string[] Amplios);

public static class PerfilesFuncion
{
    public static IReadOnlyList<PerfilFuncion> Todos { get; } =
    [
        new("edicion_imagenes",
            "Editar imágenes",
            "editar imágenes",
            "Recibe imágenes elegidas por la persona y las modifica.",
            ["images", "storage", "ui", "interaction"],
            ["filesystem", "documents"],
            []),
        new("notas",
            "Tomar notas",
            "tomar notas",
            "Guarda notas en el almacenamiento de la propia extensión.",
            ["storage", "ui", "interaction"],
            [],
            []),
        new("clima",
            "Mostrar el clima local",
            "mostrar el clima del lugar donde está la persona",
            "Consulta el pronóstico a partir de la ubicación.",
            ["location", "storage", "ui"],
            [],
            []),
        new("pdf",
            "Convertir documentos a PDF",
            "convertir documentos a PDF",
            "Trabaja con archivos que la persona quiere convertir o guardar.",
            ["documents", "storage", "ui", "interaction"],
            ["filesystem"],
            []),
        new("gestor_contrasenas",
            "Guardar y completar contraseñas",
            "guardar y completar contraseñas",
            "Rellena credenciales en los sitios donde la persona tiene una cuenta.",
            ["storage", "identity", "ui", "interaction", "clipboard"],
            [],
            ["network_all", "browsing"]),
        new("productividad",
            "Utilidad de productividad",
            "ayudar en una tarea de productividad",
            "Una utilidad general que trabaja cuando la persona la invoca.",
            ["storage", "ui", "interaction"],
            ["documents"],
            []),
        new("otro",
            "Otra función",
            "cumplir la función descrita en el texto libre",
            "Sin un perfil más específico, solo el almacenamiento y la interfaz se consideran acordes.",
            ["storage", "ui"],
            [],
            [])
    ];

    public static PerfilFuncion? Buscar(string? clave) =>
        string.IsNullOrWhiteSpace(clave)
            ? null
            : Todos.FirstOrDefault(p => p.Clave.Equals(clave.Trim(), StringComparison.OrdinalIgnoreCase));
}
