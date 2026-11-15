package br.com.pontomax.terminal;

import android.app.admin.DeviceAdminReceiver;

/**
 * Administrador do dispositivo: permite tornar o terminal "dono do dispositivo" (device owner) e
 * travar o aparelho só nele (lock task), sem MDM. Ativado por:
 *   adb shell dpm set-device-owner br.com.pontomax.terminal/.KioskAdminReceiver
 */
public class KioskAdminReceiver extends DeviceAdminReceiver {}
