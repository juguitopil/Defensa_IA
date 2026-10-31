using Microsoft.EntityFrameworkCore;

namespace PermissionGuardian.Api.Data;

public static class ActualizacionEsquema
{
    public static async Task AplicarAsync(AppDbContext db, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            IF COL_LENGTH('APLICACION', 'FUNCION_CONFIRMADA') IS NULL
                ALTER TABLE APLICACION ADD FUNCION_CONFIRMADA bit NOT NULL
                    CONSTRAINT DF_APLICACION_FUNCION_CONFIRMADA DEFAULT 1;
            """, ct);

        await db.Database.ExecuteSqlRawAsync(
            """
            IF COL_LENGTH('APLICACION', 'FECHA_ULTIMA_REVISION') IS NULL
                ALTER TABLE APLICACION ADD FECHA_ULTIMA_REVISION datetime2 NULL;
            """, ct);

        await db.Database.ExecuteSqlRawAsync(
            """
            IF EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'VERSION_APLICACION' AND COLUMN_NAME = 'NUMERO'
                  AND CHARACTER_MAXIMUM_LENGTH < 80)
                ALTER TABLE VERSION_APLICACION ALTER COLUMN NUMERO nvarchar(80) NOT NULL;
            """, ct);
    }
}
