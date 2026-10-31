# Permission Guardian

Permission Guardian compara la función que declara una aplicación con los permisos que solicita. Explica el desajuste, guarda el informe y avisa cuando una versión nueva amplía el acceso.

La puntuación sale de un motor de reglas. Un agente en la extensión de Chrome revisa lo que está instalado y vuelve a evaluar lo ya guardado. La persona confirma la función cuando el agente registra una extensión nueva. El sistema no bloquea extensiones.

## Qué hace y cómo

La pregunta que responde es si los permisos se parecen a lo que la aplicación dice que hace. Leer todos los sitios web es un acceso enorme para un editor de fotos. El mismo permiso es esperable en un gestor de contraseñas, porque tiene que rellenar el inicio de sesión en cualquier página.

El programa no instala la extensión ni le concede permisos. Lee lo que el manifiesto de Chrome ya declara y escribe un informe.

Hay dos caminos.

**A mano.** En la página registras nombre, función y permisos, o en el popup eliges una extensión instalada y la función que declara. Esa elección queda confirmada. La API guarda la aplicación y el motor de reglas calcula la puntuación.

**Con el agente.** Un script en segundo plano de la extensión lee las demás extensiones al arrancar Chrome, cada 30 minutos, o cuando pulsas **Revisar ahora**. Envía esa lista a `POST /api/agente/reevaluar`. El agente decide y después entran las mismas reglas:

- Si la extensión es nueva, la registra con la función «Otra función» y queda pendiente de confirmar.
- Si la versión y los permisos no cambiaron, anota la fecha de revisión y conserva la puntuación.
- Si cambiaron los permisos, guarda una versión nueva y la compara con la anterior. Si Chrome mantiene el mismo número, esa revisión se guarda como `1.0 · revisión 2`.

Una función que ya confirmaste no se sustituye. Si una extensión guardada ya no está instalada, el popup lo dice y el informe se conserva.

En la página, abres la extensión pendiente, eliges la función real y pulsas **Confirmar función y volver a evaluar**. Las reglas vuelven a correr con esa función.

Cada permiso del catálogo tiene una sensibilidad. Ese peso se achica si el propósito encaja con la función y se queda entero si el permiso es sensible y no encaja. La suma, de 0 a 100, es la puntuación. Con los mismos datos el número es el mismo. Si configuras un modelo de lenguaje, solo reescribe la explicación.

El catálogo cubre permisos de extensiones de Chrome (Manifest V3), más cámara, micrófono, archivos locales y sitios web. Android y programas de Windows quedan fuera de esta versión.

## Qué hay que instalar

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- SQL Server en `localhost`, con autenticación de Windows. Sirve SQL Server Express o la instancia local de SQL Server.
- Google Chrome, para la extensión.

Comprueba las dos primeras con:

```powershell
dotnet --version
sqlcmd -S localhost -E -Q "SELECT @@VERSION"
```

La cadena de conexión está en `src/PermissionGuardian.Api/appsettings.json`:

```text
Server=localhost;Database=PermissionGuardian;Trusted_Connection=True;TrustServerCertificate=True
```

No hace falta crear la base a mano. Al arrancar, la API la crea si no existe y carga cinco aplicaciones de demostración.

## Cómo ponerlo a funcionar

En la carpeta del proyecto:

```powershell
dotnet run --project src/PermissionGuardian.Api
```

Abre [http://localhost:5080](http://localhost:5080). La primera vez tarda un poco porque restaura paquetes y crea la base `PermissionGuardian`.

Para ver el caso de demostración, abre **Photo Editor**. La versión 1.0 pide permisos acordes con editar imágenes. La 2.0 añade sitios web y archivos, y la puntuación sube a 78, riesgo crítico. **Llave Segura** también pide todos los sitios, pero como gestor de contraseñas ese acceso está contemplado y queda en 29, riesgo medio.

Swagger, en desarrollo: [http://localhost:5080/swagger](http://localhost:5080/swagger).

### Extensión de Chrome

1. Abre `chrome://extensions`.
2. Activa el **modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y elige la carpeta `extension` del proyecto.
4. Si ya estaba cargada, pulsa **Recargar**. Chrome pide aceptar `alarms` y `storage` si aún no los tenía.

La API tiene que estar en el puerto 5080. El permiso `management` solo lee los permisos declarados de las demás extensiones. `alarms` repite la revisión.

Prueba del agente:

1. Abre el icono de Permission Guardian.
2. Pulsa **Revisar ahora**.
3. Vuelve a [http://localhost:5080](http://localhost:5080).

Una extensión que no estuviera guardada aparece con **Función sin confirmar**. Ábrela, indica qué promete hacer y confirma. La puntuación se recalcula. Si no cambió nada, el popup dice que sigue sin cambios.

**Analizar en Permission Guardian**, en el mismo popup, sirve para elegir la función a mano. Esa elección queda confirmada.

## Puntuación

La calcula el motor de reglas, no el modelo de lenguaje.

| Sensibilidad | Peso |
| --- | --- |
| Baja | 5 |
| Media | 16 |
| Alta | 30 |
| Crítica | 54 |

Si el permiso encaja con la función, el peso se multiplica por 0,10, o por 0,22 si es sensible. Si es amplio y la función lo contempla, por 0,38. Si la relación es parcial, por 0,75. Si es sensible y no encaja, cuenta entero. La suma se redondea y se corta en 100.

| Puntuación | Nivel |
| --- | --- |
| 0–19 | Riesgo bajo |
| 20–44 | Riesgo medio |
| 45–74 | Riesgo alto |
| 75–100 | Riesgo crítico |

Una versión nueva se marca como cambio importante si aparece un permiso alto o crítico que antes no estaba, o si la puntuación sube 20 puntos o más.

Photo Editor 2.0 queda en 78: las imágenes encajan, el acceso a todos los archivos se marca para revisar y leer cualquier sitio queda como riesgo elevado. Llave Segura también pide todos los sitios, pero un gestor de contraseñas lo tiene contemplado: el permiso se marca como amplio y justificado, y la puntuación no sube al nivel crítico.

## Modelo de lenguaje

Opcional. Si no hay clave, la explicación sale del motor de reglas y la puntuación no cambia.

```powershell
$env:Ia__ApiKey = "la-clave"
$env:Ia__BaseUrl = "https://api.openai.com/v1"
$env:Ia__Modelo = "gpt-4o-mini"
dotnet run --project src/PermissionGuardian.Api
```

El modelo recibe el resultado ya calculado y solo redacta. No concede permisos ni decide que una aplicación sea dañina.

## Pruebas

```powershell
dotnet test
```

## Arquitectura

| Pieza | Tecnología | Qué hace |
| --- | --- | --- |
| Interfaz | HTML, CSS, JavaScript | Informes, registro, historial y comparación |
| API | ASP.NET Core 8 | Recibe aplicaciones y guarda el análisis |
| Datos | SQL Server | Aplicaciones, versiones, permisos, análisis y alertas |
| Reglas | C# | Clasifica, puntúa y compara versiones |
| Agente | Extensión y `POST /api/agente/reevaluar` | Revisa lo instalado y decide si registra, deja igual o abre una versión |
| Redacción | API compatible con OpenAI | Opcional. Explica el resultado de las reglas |
| Extensión | Manifest V3 | Lee permisos ya declarados. No los cambia ni los concede |

En local el perfil de desarrollo usa HTTP en `localhost`. Al publicar, el proceso redirige a HTTPS.
