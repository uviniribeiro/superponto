// Primitivas do OpenSSL (libcrypto 3) via FFI: scrypt e AES-256-GCM, idênticas às do Node.
import 'dart:ffi';
import 'dart:io';
import 'dart:isolate';
import 'dart:math';
import 'dart:typed_data';

import 'package:ffi/ffi.dart';

DynamicLibrary _open() {
  final candidates = Platform.isMacOS
      ? ['libcrypto.3.dylib', '/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib', '/usr/local/opt/openssl@3/lib/libcrypto.3.dylib']
      : Platform.isWindows
          ? ['libcrypto-3-x64.dll']
          : ['libcrypto.so.3', 'libcrypto.so'];
  for (final c in candidates) {
    try {
      return DynamicLibrary.open(c);
    } catch (_) {/* próximo */}
  }
  throw StateError('OpenSSL 3 (libcrypto) não encontrado no sistema');
}

final _lib = _open();

typedef _ScryptC = Int32 Function(Pointer<Uint8>, Size, Pointer<Uint8>, Size, Uint64, Uint64, Uint64, Uint64, Pointer<Uint8>, Size);
typedef _ScryptD = int Function(Pointer<Uint8>, int, Pointer<Uint8>, int, int, int, int, int, Pointer<Uint8>, int);
final _scrypt = _lib.lookupFunction<_ScryptC, _ScryptD>('EVP_PBE_scrypt');

final _ctxNew = _lib.lookupFunction<Pointer<Void> Function(), Pointer<Void> Function()>('EVP_CIPHER_CTX_new');
final _ctxFree = _lib.lookupFunction<Void Function(Pointer<Void>), void Function(Pointer<Void>)>('EVP_CIPHER_CTX_free');
final _aes256gcm = _lib.lookupFunction<Pointer<Void> Function(), Pointer<Void> Function()>('EVP_aes_256_gcm');
typedef _InitC = Int32 Function(Pointer<Void>, Pointer<Void>, Pointer<Void>, Pointer<Uint8>, Pointer<Uint8>);
typedef _InitD = int Function(Pointer<Void>, Pointer<Void>, Pointer<Void>, Pointer<Uint8>, Pointer<Uint8>);
final _encInit = _lib.lookupFunction<_InitC, _InitD>('EVP_EncryptInit_ex');
final _decInit = _lib.lookupFunction<_InitC, _InitD>('EVP_DecryptInit_ex');
typedef _UpdC = Int32 Function(Pointer<Void>, Pointer<Uint8>, Pointer<Int32>, Pointer<Uint8>, Int32);
typedef _UpdD = int Function(Pointer<Void>, Pointer<Uint8>, Pointer<Int32>, Pointer<Uint8>, int);
final _encUpdate = _lib.lookupFunction<_UpdC, _UpdD>('EVP_EncryptUpdate');
final _decUpdate = _lib.lookupFunction<_UpdC, _UpdD>('EVP_DecryptUpdate');
typedef _FinC = Int32 Function(Pointer<Void>, Pointer<Uint8>, Pointer<Int32>);
typedef _FinD = int Function(Pointer<Void>, Pointer<Uint8>, Pointer<Int32>);
final _encFinal = _lib.lookupFunction<_FinC, _FinD>('EVP_EncryptFinal_ex');
final _decFinal = _lib.lookupFunction<_FinC, _FinD>('EVP_DecryptFinal_ex');
typedef _CtrlC = Int32 Function(Pointer<Void>, Int32, Int32, Pointer<Uint8>);
typedef _CtrlD = int Function(Pointer<Void>, int, int, Pointer<Uint8>);
final _ctrl = _lib.lookupFunction<_CtrlC, _CtrlD>('EVP_CIPHER_CTX_ctrl');
const _gcmSetIvLen = 0x9, _gcmGetTag = 0x10, _gcmSetTag = 0x11;

Pointer<Uint8> _copy(Arena a, List<int> data) {
  final p = a<Uint8>(max(1, data.length));
  p.asTypedList(max(1, data.length)).setRange(0, data.length, data);
  return p;
}

/// scrypt síncrono (bloqueia a isolate: use [scrypt] no servidor).
Uint8List scryptSync(List<int> password, List<int> salt, {required int n, required int r, required int p, required int keyLength}) {
  return using((a) {
    final out = a<Uint8>(keyLength);
    final maxmem = 128 * r * (n + p + 2) + 1024 * 1024;
    final ok = _scrypt(_copy(a, password), password.length, _copy(a, salt), salt.length, n, r, p, maxmem, out, keyLength);
    if (ok != 1) throw StateError('scrypt falhou');
    return Uint8List.fromList(out.asTypedList(keyLength));
  });
}

/// scrypt em outra isolate (não trava as requisições enquanto deriva a chave).
Future<Uint8List> scrypt(List<int> password, List<int> salt, {required int n, required int r, required int p, required int keyLength}) {
  final pw = Uint8List.fromList(password), s = Uint8List.fromList(salt);
  return Isolate.run(() => scryptSync(pw, s, n: n, r: r, p: p, keyLength: keyLength));
}

/// AES-256-GCM: devolve (cifrado, tag de 16 bytes).
({Uint8List data, Uint8List tag}) aesGcmEncrypt(List<int> key, List<int> iv, List<int> plain, {List<int> aad = const []}) {
  return using((a) {
    final ctx = _ctxNew();
    try {
      if (_encInit(ctx, _aes256gcm(), nullptr, nullptr, nullptr) != 1) throw StateError('AES-GCM init');
      _ctrl(ctx, _gcmSetIvLen, iv.length, nullptr);
      if (_encInit(ctx, nullptr, nullptr, _copy(a, key), _copy(a, iv)) != 1) throw StateError('AES-GCM chave');
      final len = a<Int32>();
      if (aad.isNotEmpty) _encUpdate(ctx, nullptr, len, _copy(a, aad), aad.length);
      final out = a<Uint8>(plain.length + 16);
      var total = 0;
      if (plain.isNotEmpty) {
        _encUpdate(ctx, out, len, _copy(a, plain), plain.length);
        total = len.value;
      }
      _encFinal(ctx, out + total, len);
      total += len.value;
      final tag = a<Uint8>(16);
      _ctrl(ctx, _gcmGetTag, 16, tag);
      return (data: Uint8List.fromList(out.asTypedList(max(1, total)).sublist(0, total)), tag: Uint8List.fromList(tag.asTypedList(16)));
    } finally {
      _ctxFree(ctx);
    }
  });
}

/// AES-256-GCM: lança [StateError] se a tag não confere.
Uint8List aesGcmDecrypt(List<int> key, List<int> iv, List<int> data, List<int> tag, {List<int> aad = const []}) {
  return using((a) {
    final ctx = _ctxNew();
    try {
      if (_decInit(ctx, _aes256gcm(), nullptr, nullptr, nullptr) != 1) throw StateError('AES-GCM init');
      _ctrl(ctx, _gcmSetIvLen, iv.length, nullptr);
      if (_decInit(ctx, nullptr, nullptr, _copy(a, key), _copy(a, iv)) != 1) throw StateError('AES-GCM chave');
      final len = a<Int32>();
      if (aad.isNotEmpty) _decUpdate(ctx, nullptr, len, _copy(a, aad), aad.length);
      final out = a<Uint8>(data.length + 16);
      var total = 0;
      if (data.isNotEmpty) {
        _decUpdate(ctx, out, len, _copy(a, data), data.length);
        total = len.value;
      }
      _ctrl(ctx, _gcmSetTag, tag.length, _copy(a, tag));
      if (_decFinal(ctx, out + total, len) != 1) throw StateError('Dado cifrado adulterado ou chave errada');
      total += len.value;
      return Uint8List.fromList(out.asTypedList(max(1, total)).sublist(0, total));
    } finally {
      _ctxFree(ctx);
    }
  });
}

final _rng = Random.secure();
Uint8List randomBytes(int n) => Uint8List.fromList(List<int>.generate(n, (_) => _rng.nextInt(256)));
