// Usuário autenticado, como as rotas o recebem. Nunca contém hash de senha.

class Grant {
  const Grant({required this.permission, required this.scope, this.companyId, this.unitId, this.departmentId});
  final String permission;
  /// PLATFORM, TENANT, COMPANY, UNIT, DEPARTMENT ou SELF
  final String scope;
  final String? companyId, unitId, departmentId;
}

class AuthUser {
  const AuthUser({
    required this.id, required this.email, required this.displayName, this.tenantId, this.personId,
    this.isPlatformAdmin = false, this.isSupport = false, this.mustChangePassword = false, this.grants = const [],
  });
  final String id, email, displayName;
  final String? tenantId, personId;
  final bool isPlatformAdmin, isSupport, mustChangePassword;
  final List<Grant> grants;

  Map<String, Object?> toPublic() => {
        'id': id, 'email': email, 'displayName': displayName, 'tenantId': tenantId, 'personId': personId,
        'isPlatformAdmin': isPlatformAdmin, 'isSupport': isSupport, 'mustChangePassword': mustChangePassword,
        'permissions': ({for (final g in grants) g.permission}.toList()..sort()),
      };
}

/// Recursos que limitam o escopo de uma atribuição.
class ResourceScope {
  const ResourceScope({this.companyId, this.unitId, this.departmentId});
  final String? companyId, unitId, departmentId;
}

/// O usuário tem a permissão para o recurso (respeitando o escopo da atribuição)?
bool can(AuthUser user, String permission, [ResourceScope resource = const ResourceScope()]) {
  if (user.isPlatformAdmin) return true;
  return user.grants.any((g) {
    if (g.permission != permission) return false;
    return switch (g.scope) {
      'PLATFORM' || 'TENANT' || 'SELF' => true,
      'COMPANY' => resource.companyId == null || resource.companyId == g.companyId,
      'UNIT' => resource.unitId == null || resource.unitId == g.unitId,
      'DEPARTMENT' => resource.departmentId == null || resource.departmentId == g.departmentId,
      _ => false,
    };
  });
}
