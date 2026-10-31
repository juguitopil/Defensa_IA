using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace PermissionGuardian.Api.Reglas;

public sealed class ExplicadorIa(HttpClient http, IConfiguration configuracion, ILogger<ExplicadorIa> registro)
{
    public bool EstaConfigurada => !string.IsNullOrWhiteSpace(configuracion["Ia:ApiKey"]);

    public async Task<string?> RedactarAsync(
        string nombre,
        string enunciadoFuncion,
        string? descripcion,
        string version,
        ResultadoReglas reglas,
        CancellationToken ct)
    {
        var clave = configuracion["Ia:ApiKey"];
        if (string.IsNullOrWhiteSpace(clave)) return null;

        var baseUrl = (configuracion["Ia:BaseUrl"] ?? "https://api.openai.com/v1").TrimEnd('/');
        var modelo = configuracion["Ia:Modelo"] ?? "gpt-4o-mini";
        var payload = new
        {
            model = modelo,
            temperature = 0.2,
            max_tokens = 450,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content =
                        "Eres el redactor de Permission Guardian. Recibes el resultado de un motor de reglas que ya calculó la puntuación y la coherencia de cada permiso. " +
                        "Tu único trabajo es explicar ese resultado en español, en un párrafo de 90 a 140 palabras. " +
                        "No cambies la puntuación ni la clasificación. " +
                        "No afirmes que la aplicación es maliciosa, malware, un virus o una estafa. Un permiso amplio es un indicio de alcance, no una prueba de intención. " +
                        "Distingue lo que el permiso permite de lo que no está demostrado. " +
                        "Menciona la función declarada y los permisos concretos que el motor marcó. " +
                        "Cierra con una recomendación práctica para una persona no técnica. Escribe prosa, sin viñetas."
                },
                new
                {
                    role = "user",
                    content = JsonSerializer.Serialize(new
                    {
                        aplicacion = nombre,
                        version,
                        funcion = enunciadoFuncion,
                        descripcion,
                        puntuacion = reglas.Puntuacion,
                        nivel = reglas.Nivel.ToString(),
                        recomendacion = reglas.Recomendacion,
                        permisos = reglas.Permisos.Select(p => new
                        {
                            p.Nombre,
                            nivel = p.Nivel.ToString(),
                            coherencia = p.Coherencia.ToString(),
                            p.Consecuencia,
                            p.Evidencia
                        })
                    })
                }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", clave);
            request.Content = JsonContent.Create(payload);
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                registro.LogWarning("El modelo de lenguaje respondió {StatusCode}. Se usa la explicación del motor de reglas.", (int)response.StatusCode);
                return null;
            }

            using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var texto = document.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();
            return string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or KeyNotFoundException or JsonException)
        {
            registro.LogWarning(ex, "No se pudo obtener la explicación del modelo de lenguaje.");
            return null;
        }
    }
}
