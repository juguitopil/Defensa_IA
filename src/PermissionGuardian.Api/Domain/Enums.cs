namespace PermissionGuardian.Api.Domain;

public enum NivelRiesgo
{
    Bajo = 0,
    Medio = 1,
    Alto = 2,
    Critico = 3
}

public enum Coherencia
{
    Coherente = 0,
    Revisar = 1,
    RiesgoElevado = 2,
    AmplioJustificado = 3
}
