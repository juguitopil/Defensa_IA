using Microsoft.EntityFrameworkCore;
using PermissionGuardian.Api.Domain;

namespace PermissionGuardian.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Aplicacion> Aplicaciones => Set<Aplicacion>();
    public DbSet<VersionAplicacion> Versiones => Set<VersionAplicacion>();
    public DbSet<Permiso> Permisos => Set<Permiso>();
    public DbSet<AplicacionPermiso> AplicacionPermisos => Set<AplicacionPermiso>();
    public DbSet<Analisis> Analisis => Set<Analisis>();
    public DbSet<Alerta> Alertas => Set<Alerta>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigurarUsuario(modelBuilder);
        ConfigurarAplicacion(modelBuilder);
        ConfigurarVersion(modelBuilder);
        ConfigurarPermiso(modelBuilder);
        ConfigurarAplicacionPermiso(modelBuilder);
        ConfigurarAnalisis(modelBuilder);
        ConfigurarAlerta(modelBuilder);
    }

    private static void ConfigurarUsuario(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<Usuario>();
        entidad.ToTable("USUARIO");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_USUARIO");
        entidad.Property(x => x.Nombre).HasColumnName("NOMBRE").HasMaxLength(120).IsRequired();
        entidad.Property(x => x.Correo).HasColumnName("CORREO").HasMaxLength(200).IsRequired();
        entidad.Property(x => x.Clave).HasColumnName("CLAVE").HasMaxLength(500).IsRequired();
        entidad.HasIndex(x => x.Correo).IsUnique();
    }

    private static void ConfigurarAplicacion(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<Aplicacion>();
        entidad.ToTable("APLICACION");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_APLICACION");
        entidad.Property(x => x.Nombre).HasColumnName("NOMBRE").HasMaxLength(160).IsRequired();
        entidad.Property(x => x.Descripcion).HasColumnName("DESCRIPCION").HasMaxLength(2000).IsRequired();
        entidad.Property(x => x.Categoria).HasColumnName("CATEGORIA").HasMaxLength(80).IsRequired();
        entidad.Property(x => x.FuncionPrincipal).HasColumnName("FUNCION_PRINCIPAL").HasMaxLength(80).IsRequired();
        entidad.Property(x => x.Desarrollador).HasColumnName("DESARROLLADOR").HasMaxLength(160).IsRequired();
        entidad.Property(x => x.OrigenId).HasColumnName("ORIGEN_ID").HasMaxLength(120);
        entidad.Property(x => x.FuncionConfirmada).HasColumnName("FUNCION_CONFIRMADA");
        entidad.Property(x => x.FechaUltimaRevision).HasColumnName("FECHA_ULTIMA_REVISION");
        entidad.Property(x => x.FechaRegistro).HasColumnName("FECHA_REGISTRO");
        entidad.HasIndex(x => x.OrigenId);
    }

    private static void ConfigurarVersion(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<VersionAplicacion>();
        entidad.ToTable("VERSION_APLICACION");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_VERSION");
        entidad.Property(x => x.AplicacionId).HasColumnName("ID_APLICACION");
        entidad.Property(x => x.Numero).HasColumnName("NUMERO").HasMaxLength(80).IsRequired();
        entidad.Property(x => x.Fecha).HasColumnName("FECHA");
        entidad.HasIndex(x => new { x.AplicacionId, x.Numero }).IsUnique();
        entidad.HasOne(x => x.Aplicacion)
            .WithMany(x => x.Versiones)
            .HasForeignKey(x => x.AplicacionId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigurarPermiso(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<Permiso>();
        entidad.ToTable("PERMISO");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_PERMISO");
        entidad.Property(x => x.Clave).HasColumnName("CLAVE").HasMaxLength(80).IsRequired();
        entidad.Property(x => x.Nombre).HasColumnName("NOMBRE").HasMaxLength(160).IsRequired();
        entidad.Property(x => x.Descripcion).HasColumnName("DESCRIPCION").HasMaxLength(500).IsRequired();
        entidad.Property(x => x.Consecuencia).HasColumnName("CONSECUENCIA").HasMaxLength(500).IsRequired();
        entidad.Property(x => x.NivelRiesgo).HasColumnName("NIVEL_RIESGO").HasConversion<string>().HasMaxLength(20);
        entidad.Property(x => x.Propositos).HasColumnName("PROPOSITOS").HasMaxLength(200).IsRequired();
        entidad.HasIndex(x => x.Clave).IsUnique();
    }

    private static void ConfigurarAplicacionPermiso(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<AplicacionPermiso>();
        entidad.ToTable("APLICACION_PERMISO");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_APLICACION_PERMISO");
        entidad.Property(x => x.VersionAplicacionId).HasColumnName("ID_VERSION");
        entidad.Property(x => x.PermisoId).HasColumnName("ID_PERMISO");
        entidad.HasIndex(x => new { x.VersionAplicacionId, x.PermisoId }).IsUnique();
        entidad.HasOne(x => x.Version)
            .WithMany(x => x.Permisos)
            .HasForeignKey(x => x.VersionAplicacionId)
            .OnDelete(DeleteBehavior.Cascade);
        entidad.HasOne(x => x.Permiso)
            .WithMany()
            .HasForeignKey(x => x.PermisoId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigurarAnalisis(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<Analisis>();
        entidad.ToTable("ANALISIS");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_ANALISIS");
        entidad.Property(x => x.VersionAplicacionId).HasColumnName("ID_VERSION");
        entidad.Property(x => x.Fecha).HasColumnName("FECHA");
        entidad.Property(x => x.Puntuacion).HasColumnName("PUNTUACION");
        entidad.Property(x => x.NivelRiesgo).HasColumnName("NIVEL_RIESGO").HasConversion<string>().HasMaxLength(20);
        entidad.Property(x => x.Explicacion).HasColumnName("EXPLICACION").IsRequired();
        entidad.Property(x => x.ExplicacionReglas).HasColumnName("EXPLICACION_REGLAS").IsRequired();
        entidad.Property(x => x.FuenteExplicacion).HasColumnName("FUENTE_EXPLICACION").HasMaxLength(20).IsRequired();
        entidad.Property(x => x.AdvertenciaIa).HasColumnName("ADVERTENCIA_IA").HasMaxLength(300);
        entidad.Property(x => x.Recomendacion).HasColumnName("RECOMENDACION").HasMaxLength(500).IsRequired();
        entidad.Property(x => x.CambioImportante).HasColumnName("CAMBIO_IMPORTANTE");
        entidad.HasOne(x => x.Version)
            .WithOne(x => x.Analisis)
            .HasForeignKey<Analisis>(x => x.VersionAplicacionId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigurarAlerta(ModelBuilder modelBuilder)
    {
        var entidad = modelBuilder.Entity<Alerta>();
        entidad.ToTable("ALERTA");
        entidad.HasKey(x => x.Id);
        entidad.Property(x => x.Id).HasColumnName("ID_ALERTA");
        entidad.Property(x => x.AnalisisId).HasColumnName("ID_ANALISIS");
        entidad.Property(x => x.PermisoId).HasColumnName("ID_PERMISO");
        entidad.Property(x => x.Coherencia).HasColumnName("COHERENCIA").HasConversion<string>().HasMaxLength(30);
        entidad.Property(x => x.Evidencia).HasColumnName("DESCRIPCION").HasMaxLength(2000).IsRequired();
        entidad.Property(x => x.Recomendacion).HasColumnName("RECOMENDACION").HasMaxLength(500).IsRequired();
        entidad.Property(x => x.Aporte).HasColumnName("APORTE").HasColumnType("decimal(8,2)");
        entidad.Property(x => x.EsAlerta).HasColumnName("ES_ALERTA");
        entidad.Property(x => x.EsCambio).HasColumnName("ES_CAMBIO");
        entidad.HasOne(x => x.Analisis)
            .WithMany(x => x.Alertas)
            .HasForeignKey(x => x.AnalisisId)
            .OnDelete(DeleteBehavior.Cascade);
        entidad.HasOne(x => x.Permiso)
            .WithMany()
            .HasForeignKey(x => x.PermisoId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
