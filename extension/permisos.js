const mapaHost = {
  "<all_urls>": "all_urls",
  "*://*/*": "all_urls",
  "http://*/*": "all_urls",
  "https://*/*": "all_urls",
  "file:///*": "file_urls",
  "file://*": "file_urls"
};

function normalizarPermiso(permiso) {
  if (mapaHost[permiso]) return mapaHost[permiso];
  if (permiso.includes("://")) return "host_specific";
  return permiso;
}

function permisosDeExtension(extension) {
  const crudos = [...(extension.permissions || []), ...(extension.hostPermissions || [])];
  return [...new Set(crudos.map(normalizarPermiso))];
}
