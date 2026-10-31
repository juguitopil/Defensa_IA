using Microsoft.EntityFrameworkCore;
using PermissionGuardian.Api.Reglas;
using PermissionGuardian.Api.Contratos;
using PermissionGuardian.Api.Data;
using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Servicios;

public sealed class ServicioAnalisis(AppDbContext db, ExplicadorIa explicador)
{
    public async Task<IReadOnlyList<AplicacionResumenDto>> ListarAsync(CancellationToken ct)
    {
        var aplicaciones = await Consulta().ToListAsync(ct);
        return aplicaciones
            .Select(MapearResumen)
            .OrderByDescending(a => a.FechaAnalisis)
            .ThenByDescending(a => a.Id)
            .ToList();
    }

    public async Task<AplicacionDetalleDto?> ObtenerAsync(int id, CancellationToken ct)
    {
        var aplicacion = await CargarAsync(id, ct);
        return aplicacion is null ? null : MapearDetalle(aplicacion);
    }

    public Task<ResultadoOperacion<AplicacionDetalleDto>> CrearAsync(
        CrearAplicacionRequest solicitud,
        bool usarIa,
        DateTime? fecha,
        CancellationToken ct) =>
        CrearInternoAsync(solicitud, usarIa, fecha, permitirDesconocidos: false, ct);

    public Task<ResultadoOperacion<AplicacionDetalleDto>> AgregarVersionAsync(
        int aplicacionId,
        NuevaVersionRequest solicitud,
        bool usarIa,
        DateTime? fecha,
        CancellationToken ct) =>
        AgregarVersionInternoAsync(aplicacionId, solicitud, usarIa, fecha, permitirDesconocidos: false, ct);

    private async Task<ResultadoOperacion<AplicacionDetalleDto>> AgregarVersionInternoAsync(
        int aplicacionId,
        NuevaVersionRequest solicitud,
        bool usarIa,
        DateTime? fecha,
        bool permitirDesconocidos,
        CancellationToken ct,
        bool marcarRevision = false)
    {
        var error = ValidarVersion(solicitud.Version, solicitud.Permisos);
        if (error is not null) return ResultadoOperacion<AplicacionDetalleDto>.Fallo(error, 400);

        var aplicacion = await CargarAsync(aplicacionId, ct);
        if (aplicacion is null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("No se encontró la aplicación.", 404);

        var numero = solicitud.Version!.Trim();
        if (aplicacion.Versiones.Any(v => v.Numero.Equals(numero, StringComparison.OrdinalIgnoreCase)))
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("Esa versión ya está registrada.", 409);

        var claves = Normalizar(solicitud.Permisos);
        var permisos = await AsegurarPermisosAsync(claves, permitirDesconocidos, ct);
        if (permisos.Error is not null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo(permisos.Error, permisos.Status);

        var momento = fecha ?? DateTime.UtcNow;
        var anterior = Ultima(aplicacion);
        var version = NuevaVersion(numero, momento, permisos.Valor!);
        aplicacion.Versiones.Add(version);
        await AdjuntarAnalisisAsync(aplicacion, version, permisos.Valor!, claves, anterior, usarIa, momento, ct);
        if (marcarRevision)
            aplicacion.FechaUltimaRevision = momento;
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion<AplicacionDetalleDto>.Ok(MapearDetalle(aplicacion));
    }

    public async Task<IReadOnlyList<HistorialDto>> HistorialAsync(CancellationToken ct)
    {
        var analisis = await db.Analisis
            .AsNoTracking()
            .Include(a => a.Version)
            .ThenInclude(v => v.Aplicacion)
            .OrderByDescending(a => a.Fecha)
            .ThenByDescending(a => a.Id)
            .ToListAsync(ct);

        return analisis.Select(a => new HistorialDto(
            a.Id,
            a.Version.AplicacionId,
            a.Version.Aplicacion.Nombre,
            a.Version.Numero,
            a.Fecha,
            a.Puntuacion,
            a.NivelRiesgo.ToString(),
            Etiquetas.Nivel(a.NivelRiesgo),
            a.CambioImportante,
            a.FuenteExplicacion)).ToList();
    }

    public async Task<ResultadoOperacion<ComparacionDto>> CompararAsync(
        int aplicacionId,
        int origenId,
        int destinoId,
        CancellationToken ct)
    {
        if (origenId == destinoId)
            return ResultadoOperacion<ComparacionDto>.Fallo("Elige dos versiones distintas.", 400);

        var aplicacion = await CargarAsync(aplicacionId, ct);
        if (aplicacion is null)
            return ResultadoOperacion<ComparacionDto>.Fallo("No se encontró la aplicación.", 404);

        var origen = aplicacion.Versiones.FirstOrDefault(v => v.Id == origenId);
        var destino = aplicacion.Versiones.FirstOrDefault(v => v.Id == destinoId);
        if (origen?.Analisis is null || destino?.Analisis is null)
            return ResultadoOperacion<ComparacionDto>.Fallo("Esas versiones no tienen un análisis guardado.", 404);

        var comparacion = ComparadorVersiones.Comparar(
            origen.Numero,
            destino.Numero,
            Desde(origen.Analisis),
            Desde(destino.Analisis));

        return ResultadoOperacion<ComparacionDto>.Ok(new ComparacionDto(
            aplicacion.Id,
            aplicacion.Nombre,
            Resumir(origen),
            Resumir(destino),
            comparacion.Delta,
            comparacion.CambioImportante,
            comparacion.Explicacion,
            comparacion.Filas.Select(f => new FilaComparacionDto(
                f.Clave,
                f.Nombre,
                f.Nivel.ToString(),
                Etiquetas.Nivel(f.Nivel),
                f.Estado)).ToList()));
    }

    public async Task<ResultadoOperacion<AplicacionDetalleDto>> ImportarAsync(
        ImportarExtensionRequest solicitud,
        CancellationToken ct)
    {
        var funcion = string.IsNullOrWhiteSpace(solicitud.FuncionPrincipal) ? "otro" : solicitud.FuncionPrincipal.Trim();
        var crear = new CrearAplicacionRequest(
            solicitud.Nombre,
            solicitud.Descripcion,
            "Extensión",
            funcion,
            solicitud.Desarrollador,
            solicitud.Version,
            solicitud.Permisos,
            solicitud.OrigenId);

        var error = ValidarAlta(crear);
        if (error is not null) return ResultadoOperacion<AplicacionDetalleDto>.Fallo(error, 400);

        var origen = solicitud.OrigenId?.Trim();
        if (!string.IsNullOrEmpty(origen))
        {
            var existente = await db.Aplicaciones.FirstOrDefaultAsync(a => a.OrigenId == origen, ct);
            if (existente is not null)
                return await ImportarExistenteAsync(existente.Id, funcion, solicitud.Version, solicitud.Permisos, ct);
        }

        return await CrearInternoAsync(crear, usarIa: true, fecha: null, permitirDesconocidos: true, ct);
    }

    public async Task<ResultadoOperacion<AplicacionDetalleDto>> ConfirmarFuncionAsync(
        int id,
        string? funcion,
        CancellationToken ct)
    {
        if (PerfilesFuncion.Buscar(funcion) is null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("Elige una función principal del catálogo.", 400);

        var aplicacion = await CargarAsync(id, ct);
        if (aplicacion is null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("No se encontró la aplicación.", 404);

        aplicacion.FuncionPrincipal = funcion!.Trim();
        aplicacion.FuncionConfirmada = true;
        await ReanalizarTodasAsync(aplicacion, DateTime.UtcNow, ct);
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion<AplicacionDetalleDto>.Ok(MapearDetalle(aplicacion));
    }

    public async Task<ResultadoOperacion<ResultadoAgenteDto>> ReevaluarAsync(
        IReadOnlyList<ExtensionInstaladaRequest>? extensiones,
        CancellationToken ct)
    {
        if (extensiones is null)
            return ResultadoOperacion<ResultadoAgenteDto>.Fallo("Falta la lista de extensiones instaladas.", 400);
        if (extensiones.Count > 300)
            return ResultadoOperacion<ResultadoAgenteDto>.Fallo("Hay demasiadas extensiones en esta revisión.", 400);

        var revisiones = new List<RevisionExtensionDto>();
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entrada in extensiones)
        {
            var origen = entrada.OrigenId?.Trim();
            if (string.IsNullOrEmpty(origen))
            {
                revisiones.Add(Revision("" , Recortar(entrada.Nombre, 160), "error", null, null, null, false,
                    "Falta el identificador de la extensión."));
                continue;
            }

            if (!ids.Add(origen))
                continue;

            revisiones.Add(await RevisarExtensionAsync(entrada, origen, ct));
        }

        var guardadas = await db.Aplicaciones.AsNoTracking()
            .Where(a => a.OrigenId != null && a.OrigenId != "")
            .Select(a => new { a.Nombre, a.OrigenId })
            .ToListAsync(ct);
        var ausentes = guardadas
            .Where(a => a.OrigenId is not null && !ids.Contains(a.OrigenId))
            .Select(a => a.Nombre)
            .OrderBy(a => a)
            .ToList();

        return ResultadoOperacion<ResultadoAgenteDto>.Ok(
            new ResultadoAgenteDto(DateTime.UtcNow, revisiones, ausentes));
    }

    private async Task<ResultadoOperacion<AplicacionDetalleDto>> ImportarExistenteAsync(
        int id,
        string funcion,
        string? version,
        IReadOnlyList<string>? permisos,
        CancellationToken ct)
    {
        var aplicacion = await CargarAsync(id, ct);
        if (aplicacion is null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("No se encontró la aplicación.", 404);

        var claves = Normalizar(permisos);
        var ultima = Ultima(aplicacion);
        var guardadas = ultima.Permisos.Select(p => p.Permiso.Clave).ToList();
        var mismos = DecisionAgente.SinCambios(ultima.Numero, guardadas, version ?? "", claves);
        var funcionCambia = !aplicacion.FuncionPrincipal.Equals(funcion, StringComparison.OrdinalIgnoreCase)
            || !aplicacion.FuncionConfirmada;

        if (mismos && !funcionCambia)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo("Esa versión ya está registrada.", 409);

        aplicacion.FuncionPrincipal = funcion;
        aplicacion.FuncionConfirmada = true;
        if (funcionCambia)
            await ReanalizarTodasAsync(aplicacion, DateTime.UtcNow, ct);

        if (mismos)
        {
            await db.SaveChangesAsync(ct);
            return ResultadoOperacion<AplicacionDetalleDto>.Ok(MapearDetalle(aplicacion));
        }

        var numero = DecisionAgente.NumeroDisponible(aplicacion.Versiones.Select(v => v.Numero), version ?? "");
        return await AgregarVersionInternoAsync(
            aplicacion.Id,
            new NuevaVersionRequest(numero, permisos),
            usarIa: true,
            fecha: null,
            permitirDesconocidos: true,
            ct);
    }

    private async Task<RevisionExtensionDto> RevisarExtensionAsync(
        ExtensionInstaladaRequest entrada,
        string origen,
        CancellationToken ct)
    {
        var nombre = Recortar(string.IsNullOrWhiteSpace(entrada.Nombre) ? origen : entrada.Nombre, 160);
        var claves = Normalizar(entrada.Permisos);
        if (claves.Count == 0)
            return await SinPermisosAsync(origen, nombre, ct);

        var version = Recortar(entrada.Version, 60);
        if (version.Length == 0)
            return Revision(origen, nombre, "error", null, null, null, false, "Indica un número de versión de hasta 80 caracteres.");

        var aplicacion = await Consulta().FirstOrDefaultAsync(a => a.OrigenId == origen, ct);
        if (aplicacion is null)
            return await RegistrarPorAgenteAsync(entrada, origen, nombre, version, claves, ct);

        var ultima = Ultima(aplicacion);
        var guardadas = ultima.Permisos.Select(p => p.Permiso.Clave).ToList();
        if (DecisionAgente.SinCambios(ultima.Numero, guardadas, version, claves))
        {
            aplicacion.FechaUltimaRevision = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            var analisis = ultima.Analisis!;
            return Revision(
                origen,
                aplicacion.Nombre,
                "sin_cambios",
                aplicacion.Id,
                analisis.Puntuacion,
                Etiquetas.Nivel(analisis.NivelRiesgo),
                aplicacion.FuncionConfirmada,
                "Sigue en la misma versión y con los mismos permisos. La puntuación no cambió.");
        }

        var numero = DecisionAgente.NumeroDisponible(aplicacion.Versiones.Select(v => v.Numero), version);
        var alta = await AgregarVersionInternoAsync(
            aplicacion.Id,
            new NuevaVersionRequest(numero, claves),
            usarIa: false,
            fecha: null,
            permitirDesconocidos: true,
            ct,
            marcarRevision: true);
        if (alta.Valor is null)
        {
            return Revision(origen, aplicacion.Nombre, "error", aplicacion.Id, null, null, aplicacion.FuncionConfirmada,
                alta.Error ?? "No se pudo guardar la versión.");
        }

        var detalle = alta.Valor.Versiones[^1].Analisis;
        var mensaje = detalle?.CambioImportante == true
            ? "Hay una versión nueva y apareció un permiso que amplía el acceso. Revisa el informe."
            : "Hay una versión nueva. Los permisos no amplían el alcance de forma importante.";
        return Revision(
            origen,
            alta.Valor.Nombre,
            "nueva_version",
            alta.Valor.Id,
            detalle?.Puntuacion,
            detalle?.NivelEtiqueta,
            alta.Valor.FuncionConfirmada,
            mensaje);
    }

    private async Task<RevisionExtensionDto> RegistrarPorAgenteAsync(
        ExtensionInstaladaRequest entrada,
        string origen,
        string nombre,
        string version,
        List<string> claves,
        CancellationToken ct)
    {
        var crear = new CrearAplicacionRequest(
            nombre,
            Recortar(entrada.Descripcion, 2000),
            "Extensión",
            "otro",
            Recortar(string.IsNullOrWhiteSpace(entrada.Desarrollador) ? null : entrada.Desarrollador, 160),
            version,
            claves,
            origen);
        var alta = await CrearInternoAsync(
            crear,
            usarIa: false,
            fecha: null,
            permitirDesconocidos: true,
            ct,
            funcionConfirmada: false,
            marcarRevision: true);
        if (alta.Valor is null)
            return Revision(origen, nombre, "error", null, null, null, false, alta.Error ?? "No se pudo registrar.");

        var analisis = alta.Valor.Versiones[^1].Analisis;
        return Revision(
            origen,
            alta.Valor.Nombre,
            "registrada",
            alta.Valor.Id,
            analisis?.Puntuacion,
            analisis?.NivelEtiqueta,
            false,
            "Se registró con la función «Otra función». Confirma qué promete hacer: hasta entonces un permiso amplio cuenta como desajuste.");
    }

    private async Task<RevisionExtensionDto> SinPermisosAsync(string origen, string nombre, CancellationToken ct)
    {
        var conocida = await db.Aplicaciones.AsNoTracking()
            .Where(a => a.OrigenId == origen)
            .Select(a => new { a.Id, a.Nombre, a.FuncionConfirmada })
            .FirstOrDefaultAsync(ct);
        if (conocida is null)
        {
            return Revision(origen, nombre, "sin_permisos", null, null, null, false,
                "No declara permisos en el manifiesto, así que no hay nada que puntuar.");
        }

        return Revision(origen, conocida.Nombre, "sin_permisos", conocida.Id, null, null, conocida.FuncionConfirmada,
            "Esta revisión no trae permisos, así que se dejó el análisis anterior.");
    }

    private async Task ReanalizarTodasAsync(Aplicacion aplicacion, DateTime momento, CancellationToken ct)
    {
        var ordenadas = aplicacion.Versiones.OrderBy(v => v.Fecha).ThenBy(v => v.Id).ToList();
        VersionAplicacion? anterior = null;
        for (var i = 0; i < ordenadas.Count; i++)
        {
            var version = ordenadas[i];
            var claves = version.Permisos.Select(p => p.Permiso.Clave).ToList();
            var permisos = version.Permisos.Select(p => p.Permiso).ToList();
            await ReescribirAnalisisAsync(
                aplicacion,
                version,
                permisos,
                claves,
                anterior,
                usarIa: i == ordenadas.Count - 1,
                momento,
                ct);
            anterior = version;
        }
    }

    private async Task ReescribirAnalisisAsync(
        Aplicacion aplicacion,
        VersionAplicacion version,
        IReadOnlyList<Permiso> permisos,
        IReadOnlyList<string> claves,
        VersionAplicacion? anterior,
        bool usarIa,
        DateTime momento,
        CancellationToken ct)
    {
        var resultado = MotorReglas.Evaluar(aplicacion.FuncionPrincipal, claves);
        var explicacion = await ExplicarAsync(aplicacion, version.Numero, resultado, usarIa, ct);
        var clavesAnteriores = anterior?.Permisos.Select(p => p.Permiso.Clave).ToList() ?? [];
        var cambio = false;
        if (anterior?.Analisis is not null)
        {
            var comparacion = ComparadorVersiones.Comparar(
                anterior.Numero,
                version.Numero,
                Desde(anterior.Analisis),
                resultado);
            cambio = comparacion.CambioImportante;
        }

        var alertas = resultado.Permisos.Select(item => new Alerta
        {
            Permiso = permisos.First(p => p.Clave.Equals(item.Clave, StringComparison.OrdinalIgnoreCase)),
            Coherencia = item.Coherencia,
            Evidencia = item.Evidencia,
            Recomendacion = item.Recomendacion,
            Aporte = item.Aporte,
            EsAlerta = item.EsAlerta,
            EsCambio = ComparadorVersiones.EsCambio(item, clavesAnteriores)
        }).ToList();

        if (version.Analisis is null)
        {
            version.Analisis = new Analisis
            {
                Fecha = momento,
                Puntuacion = resultado.Puntuacion,
                NivelRiesgo = resultado.Nivel,
                Explicacion = explicacion.Texto,
                ExplicacionReglas = explicacion.Reglas,
                FuenteExplicacion = explicacion.Fuente,
                AdvertenciaIa = explicacion.Advertencia,
                Recomendacion = resultado.Recomendacion,
                CambioImportante = cambio,
                Alertas = alertas
            };
            return;
        }

        var analisis = version.Analisis;
        db.Alertas.RemoveRange(analisis.Alertas.ToList());
        analisis.Alertas.Clear();
        analisis.Fecha = momento;
        analisis.Puntuacion = resultado.Puntuacion;
        analisis.NivelRiesgo = resultado.Nivel;
        analisis.Explicacion = explicacion.Texto;
        analisis.ExplicacionReglas = explicacion.Reglas;
        analisis.FuenteExplicacion = explicacion.Fuente;
        analisis.AdvertenciaIa = explicacion.Advertencia;
        analisis.Recomendacion = resultado.Recomendacion;
        analisis.CambioImportante = cambio;
        foreach (var alerta in alertas)
            analisis.Alertas.Add(alerta);
    }

    private static RevisionExtensionDto Revision(
        string origenId,
        string nombre,
        string accion,
        int? aplicacionId,
        int? puntuacion,
        string? nivelEtiqueta,
        bool funcionConfirmada,
        string mensaje) => new(
        origenId,
        nombre,
        accion,
        aplicacionId,
        puntuacion,
        nivelEtiqueta,
        funcionConfirmada,
        mensaje);

    private static string Recortar(string? valor, int maximo)
    {
        var texto = (valor ?? "").Trim();
        return texto.Length <= maximo ? texto : texto[..maximo];
    }

    private async Task<ResultadoOperacion<AplicacionDetalleDto>> CrearInternoAsync(
        CrearAplicacionRequest solicitud,
        bool usarIa,
        DateTime? fecha,
        bool permitirDesconocidos,
        CancellationToken ct,
        bool funcionConfirmada = true,
        bool marcarRevision = false)
    {
        var error = ValidarAlta(solicitud);
        if (error is not null) return ResultadoOperacion<AplicacionDetalleDto>.Fallo(error, 400);

        var claves = Normalizar(solicitud.Permisos);
        var permisos = await AsegurarPermisosAsync(claves, permitirDesconocidos, ct);
        if (permisos.Error is not null)
            return ResultadoOperacion<AplicacionDetalleDto>.Fallo(permisos.Error, permisos.Status);

        var momento = fecha ?? DateTime.UtcNow;
        var aplicacion = new Aplicacion
        {
            Nombre = solicitud.Nombre!.Trim(),
            Descripcion = (solicitud.Descripcion ?? "").Trim(),
            Categoria = string.IsNullOrWhiteSpace(solicitud.Categoria) ? "Sin categoría" : solicitud.Categoria.Trim(),
            FuncionPrincipal = solicitud.FuncionPrincipal!.Trim(),
            Desarrollador = string.IsNullOrWhiteSpace(solicitud.Desarrollador) ? "No indicado" : solicitud.Desarrollador.Trim(),
            OrigenId = string.IsNullOrWhiteSpace(solicitud.OrigenId) ? null : solicitud.OrigenId.Trim(),
            FuncionConfirmada = funcionConfirmada,
            FechaUltimaRevision = marcarRevision ? momento : null,
            FechaRegistro = momento
        };
        var version = NuevaVersion(solicitud.Version!.Trim(), momento, permisos.Valor!);
        aplicacion.Versiones.Add(version);
        db.Aplicaciones.Add(aplicacion);
        await AdjuntarAnalisisAsync(aplicacion, version, permisos.Valor!, claves, anterior: null, usarIa, momento, ct);
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion<AplicacionDetalleDto>.Creado(MapearDetalle(aplicacion));
    }

    private async Task AdjuntarAnalisisAsync(
        Aplicacion aplicacion,
        VersionAplicacion version,
        IReadOnlyList<Permiso> permisos,
        IReadOnlyList<string> claves,
        VersionAplicacion? anterior,
        bool usarIa,
        DateTime momento,
        CancellationToken ct)
    {
        var resultado = MotorReglas.Evaluar(aplicacion.FuncionPrincipal, claves);
        var explicacion = await ExplicarAsync(aplicacion, version.Numero, resultado, usarIa, ct);
        var clavesAnteriores = anterior?.Permisos.Select(p => p.Permiso.Clave).ToList() ?? [];
        var cambio = false;
        if (anterior?.Analisis is not null)
        {
            var comparacion = ComparadorVersiones.Comparar(
                anterior.Numero,
                version.Numero,
                Desde(anterior.Analisis),
                resultado);
            cambio = comparacion.CambioImportante;
        }

        version.Analisis = new Analisis
        {
            Fecha = momento,
            Puntuacion = resultado.Puntuacion,
            NivelRiesgo = resultado.Nivel,
            Explicacion = explicacion.Texto,
            ExplicacionReglas = explicacion.Reglas,
            FuenteExplicacion = explicacion.Fuente,
            AdvertenciaIa = explicacion.Advertencia,
            Recomendacion = resultado.Recomendacion,
            CambioImportante = cambio,
            Alertas = resultado.Permisos.Select(item => new Alerta
            {
                Permiso = permisos.First(p => p.Clave.Equals(item.Clave, StringComparison.OrdinalIgnoreCase)),
                Coherencia = item.Coherencia,
                Evidencia = item.Evidencia,
                Recomendacion = item.Recomendacion,
                Aporte = item.Aporte,
                EsAlerta = item.EsAlerta,
                EsCambio = ComparadorVersiones.EsCambio(item, clavesAnteriores)
            }).ToList()
        };
    }

    private async Task<ExplicacionGuardada> ExplicarAsync(
        Aplicacion aplicacion,
        string version,
        ResultadoReglas resultado,
        bool usarIa,
        CancellationToken ct)
    {
        var perfil = PerfilesFuncion.Buscar(aplicacion.FuncionPrincipal)!;
        var reglas = NarradorEvaluacion.Redactar(aplicacion.Nombre, perfil.Enunciado, resultado);
        if (!usarIa || !explicador.EstaConfigurada)
            return new ExplicacionGuardada(reglas, reglas, "reglas", null);

        var redactada = await explicador.RedactarAsync(
            aplicacion.Nombre,
            perfil.Enunciado,
            aplicacion.Descripcion,
            version,
            resultado,
            ct);

        return redactada is null
            ? new ExplicacionGuardada(reglas, reglas, "reglas", "No se pudo consultar el modelo de lenguaje. La explicación sale del motor de reglas.")
            : new ExplicacionGuardada(redactada, reglas, "ia", null);
    }

    private async Task<ResultadoOperacion<List<Permiso>>> AsegurarPermisosAsync(
        IReadOnlyList<string> claves,
        bool permitirDesconocidos,
        CancellationToken ct)
    {
        if (!permitirDesconocidos)
        {
            var desconocidos = claves.Where(c => CatalogoPermisos.Buscar(c) is null).ToList();
            if (desconocidos.Count > 0)
            {
                return ResultadoOperacion<List<Permiso>>.Fallo(
                    "Hay permisos que no están en el catálogo: " + Etiquetas.Unir(desconocidos),
                    400);
            }
        }

        var definiciones = claves.Select(CatalogoPermisos.Resolver).ToList();
        var canonicas = definiciones.Select(d => d.Clave).ToList();
        var existentes = await db.Permisos.Where(p => canonicas.Contains(p.Clave)).ToListAsync(ct);
        var porClave = existentes.ToDictionary(p => p.Clave, StringComparer.OrdinalIgnoreCase);

        foreach (var definicion in definiciones)
        {
            if (porClave.ContainsKey(definicion.Clave)) continue;
            if (!permitirDesconocidos)
            {
                return ResultadoOperacion<List<Permiso>>.Fallo(
                    "Falta un permiso del catálogo en la base de datos. Reinicia la aplicación.",
                    500);
            }

            var nuevo = new Permiso
            {
                Clave = definicion.Clave,
                Nombre = definicion.Nombre,
                Descripcion = definicion.Descripcion,
                Consecuencia = definicion.Consecuencia,
                NivelRiesgo = definicion.Nivel,
                Propositos = string.Join(',', definicion.Propositos)
            };
            db.Permisos.Add(nuevo);
            porClave[definicion.Clave] = nuevo;
        }

        if (porClave.Values.Any(p => p.Id == 0))
            await db.SaveChangesAsync(ct);

        return ResultadoOperacion<List<Permiso>>.Ok(definiciones.Select(d => porClave[d.Clave]).ToList());
    }

    private IQueryable<Aplicacion> Consulta() =>
        db.Aplicaciones
            .AsSplitQuery()
            .Include(a => a.Versiones)
                .ThenInclude(v => v.Analisis!)
                .ThenInclude(an => an.Alertas)
                .ThenInclude(al => al.Permiso)
            .Include(a => a.Versiones)
                .ThenInclude(v => v.Permisos)
                .ThenInclude(p => p.Permiso);

    private Task<Aplicacion?> CargarAsync(int id, CancellationToken ct) =>
        Consulta().FirstOrDefaultAsync(a => a.Id == id, ct);

    private static VersionAplicacion NuevaVersion(string numero, DateTime fecha, IReadOnlyList<Permiso> permisos)
    {
        var version = new VersionAplicacion { Numero = numero, Fecha = fecha };
        foreach (var permiso in permisos)
            version.Permisos.Add(new AplicacionPermiso { Permiso = permiso });
        return version;
    }

    private static string? ValidarAlta(CrearAplicacionRequest solicitud)
    {
        if (string.IsNullOrWhiteSpace(solicitud.Nombre) || solicitud.Nombre.Trim().Length < 2)
            return "Indica el nombre de la aplicación.";
        if (solicitud.Nombre.Trim().Length > 160)
            return "El nombre es demasiado largo.";
        if ((solicitud.Descripcion?.Length ?? 0) > 2000)
            return "La descripción es demasiado larga.";
        if (PerfilesFuncion.Buscar(solicitud.FuncionPrincipal) is null)
            return "Elige una función principal del catálogo.";
        return ValidarVersion(solicitud.Version, solicitud.Permisos);
    }

    private static string? ValidarVersion(string? version, IReadOnlyList<string>? permisos)
    {
        if (string.IsNullOrWhiteSpace(version) || version.Trim().Length > 80)
            return "Indica un número de versión de hasta 80 caracteres.";
        if (permisos is null || permisos.All(string.IsNullOrWhiteSpace))
            return "Registra al menos un permiso.";
        if (permisos.Count > 40)
            return "Hay demasiados permisos en esta versión.";
        return null;
    }

    private static List<string> Normalizar(IReadOnlyList<string>? permisos)
    {
        var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var claves = new List<string>();
        foreach (var permiso in permisos ?? [])
        {
            if (string.IsNullOrWhiteSpace(permiso)) continue;
            var definicion = CatalogoPermisos.Resolver(permiso);
            if (vistos.Add(definicion.Clave)) claves.Add(definicion.Clave);
        }
        return claves;
    }

    private static VersionAplicacion Ultima(Aplicacion aplicacion) =>
        aplicacion.Versiones.OrderBy(v => v.Fecha).ThenBy(v => v.Id).Last();

    private static AplicacionResumenDto MapearResumen(Aplicacion aplicacion)
    {
        var ultima = Ultima(aplicacion);
        var analisis = ultima.Analisis!;
        var perfil = PerfilesFuncion.Buscar(aplicacion.FuncionPrincipal);
        return new AplicacionResumenDto(
            aplicacion.Id,
            aplicacion.Nombre,
            aplicacion.Descripcion,
            aplicacion.Categoria,
            aplicacion.FuncionPrincipal,
            perfil?.Titulo ?? aplicacion.FuncionPrincipal,
            aplicacion.Desarrollador,
            ultima.Numero,
            ultima.Id,
            analisis.Puntuacion,
            analisis.NivelRiesgo.ToString(),
            Etiquetas.Nivel(analisis.NivelRiesgo),
            analisis.Alertas.Count(a => a.EsAlerta),
            analisis.CambioImportante,
            analisis.Fecha,
            aplicacion.FuncionConfirmada,
            aplicacion.FechaUltimaRevision);
    }

    private static AplicacionDetalleDto MapearDetalle(Aplicacion aplicacion)
    {
        var perfil = PerfilesFuncion.Buscar(aplicacion.FuncionPrincipal);
        return new AplicacionDetalleDto(
            aplicacion.Id,
            aplicacion.Nombre,
            aplicacion.Descripcion,
            aplicacion.Categoria,
            aplicacion.FuncionPrincipal,
            perfil?.Titulo ?? aplicacion.FuncionPrincipal,
            perfil?.Enunciado ?? aplicacion.FuncionPrincipal,
            aplicacion.Desarrollador,
            aplicacion.FechaRegistro,
            aplicacion.Versiones
                .OrderBy(v => v.Fecha)
                .ThenBy(v => v.Id)
                .Select(MapearVersion)
                .ToList(),
            aplicacion.FuncionConfirmada,
            aplicacion.FechaUltimaRevision);
    }

    private static VersionDto MapearVersion(VersionAplicacion version) => new(
        version.Id,
        version.Numero,
        version.Fecha,
        version.Permisos.Select(p => p.Permiso.Clave).ToList(),
        version.Analisis is null ? null : MapearAnalisis(version.Analisis));

    private static AnalisisDto MapearAnalisis(Analisis analisis) => new(
        analisis.Id,
        analisis.Fecha,
        analisis.Puntuacion,
        analisis.NivelRiesgo.ToString(),
        Etiquetas.Nivel(analisis.NivelRiesgo),
        analisis.Explicacion,
        analisis.ExplicacionReglas,
        analisis.FuenteExplicacion,
        analisis.AdvertenciaIa,
        analisis.Recomendacion,
        analisis.CambioImportante,
        analisis.Alertas.OrderBy(a => a.Id).Select(a => new HallazgoDto(
            a.Permiso.Clave,
            a.Permiso.Nombre,
            a.Permiso.NivelRiesgo.ToString(),
            Etiquetas.Nivel(a.Permiso.NivelRiesgo),
            a.Coherencia.ToString(),
            Etiquetas.Coherencia(a.Coherencia),
            a.Aporte,
            a.Evidencia,
            a.Recomendacion,
            a.EsAlerta,
            a.EsCambio)).ToList());

    private static VersionPuntuacionDto Resumir(VersionAplicacion version) => new(
        version.Id,
        version.Numero,
        version.Analisis!.Puntuacion,
        version.Analisis.NivelRiesgo.ToString(),
        Etiquetas.Nivel(version.Analisis.NivelRiesgo));

    private static ResultadoReglas Desde(Analisis analisis) => new(
        analisis.Puntuacion,
        analisis.NivelRiesgo,
        analisis.Alertas.OrderBy(a => a.Id).Select(a => new PermisoEvaluado(
            a.Permiso.Clave,
            a.Permiso.Nombre,
            a.Permiso.Consecuencia,
            a.Permiso.NivelRiesgo,
            a.Coherencia,
            a.Aporte,
            a.Evidencia,
            a.Recomendacion)).ToList(),
        analisis.Recomendacion);

    private sealed record ExplicacionGuardada(string Texto, string Reglas, string Fuente, string? Advertencia);
}
