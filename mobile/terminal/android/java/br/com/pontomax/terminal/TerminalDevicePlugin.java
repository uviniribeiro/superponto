package br.com.pontomax.terminal;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Recursos do aparelho para o terminal:
 *  - rede local: IP do terminal e busca de catracas/controladoras na mesma rede (Control iD e HTTP);
 *  - NFC: leitura do número (UID) de cartões MIFARE / ISO 14443 por aproximação, como numa catraca;
 *  - atalhos do sistema (Wi-Fi, configurações) e saída do modo quiosque para o administrador.
 */
@CapacitorPlugin(name = "TerminalDevice")
public class TerminalDevicePlugin extends Plugin {

    private NfcAdapter nfc;

    // ------------------------------------------------------------------ rede local
    private String localIpv4() {
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return null;
        Network n = cm.getActiveNetwork();
        LinkProperties lp = n == null ? null : cm.getLinkProperties(n);
        if (lp == null) return null;
        for (LinkAddress la : lp.getLinkAddresses()) {
            if (la.getAddress() instanceof Inet4Address && !la.getAddress().isLoopbackAddress()) return la.getAddress().getHostAddress();
        }
        return null;
    }

    @PluginMethod
    public void getNetworkInfo(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ip", localIpv4());
        r.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        r.put("android", Build.VERSION.RELEASE);
        r.put("nfc", NfcAdapter.getDefaultAdapter(getContext()) != null);
        call.resolve(r);
    }

    /** Varre a sub-rede /24 do terminal procurando equipamentos com HTTP (porta 80). */
    @PluginMethod
    public void scanLan(PluginCall call) {
        final String ip = localIpv4();
        if (ip == null) { call.reject("Sem rede local"); return; }
        final int timeout = call.getInt("timeoutMs", 350);
        final String prefix = ip.substring(0, ip.lastIndexOf('.') + 1);
        new Thread(() -> {
            final List<JSObject> found = Collections.synchronizedList(new ArrayList<>());
            ExecutorService pool = Executors.newFixedThreadPool(48);
            for (int i = 1; i < 255; i++) {
                final String host = prefix + i;
                if (host.equals(ip)) continue;
                pool.execute(() -> {
                    try (Socket s = new Socket()) {
                        s.connect(new InetSocketAddress(host, 80), timeout);
                    } catch (Exception e) { return; }
                    JSObject d = new JSObject();
                    d.put("ip", host);
                    d.put("kind", probeKind(host));
                    found.add(d);
                });
            }
            pool.shutdown();
            try { pool.awaitTermination(30, TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
            JSObject r = new JSObject();
            r.put("ip", ip);
            r.put("devices", new JSArray(found));
            call.resolve(r);
        }).start();
    }

    /** Control iD responde JSON em /login.fcgi; outros equipamentos HTTP ficam como "http". */
    private String probeKind(String host) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL("http://" + host + "/login.fcgi").openConnection();
            c.setConnectTimeout(800);
            c.setReadTimeout(800);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = c.getOutputStream()) { o.write("{}".getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
            byte[] buf = new byte[512];
            int n = in == null ? 0 : in.read(buf);
            String body = n > 0 ? new String(buf, 0, n, StandardCharsets.UTF_8) : "";
            if (body.contains("\"error\"") || body.contains("\"session\"") || body.contains("\"code\"")) return "controlid";
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
        return "http";
    }

    // ------------------------------------------------------------------ NFC (MIFARE / ISO 14443)
    @PluginMethod
    public void startNfc(PluginCall call) {
        Activity a = getActivity();
        nfc = NfcAdapter.getDefaultAdapter(getContext());
        if (nfc == null) { call.reject("Este aparelho não tem NFC"); return; }
        if (!nfc.isEnabled()) { call.reject("NFC desligado nas configurações do aparelho"); return; }
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F
            | NfcAdapter.FLAG_READER_NFC_V | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;
        a.runOnUiThread(() -> nfc.enableReaderMode(a, this::onTag, flags, null));
        call.resolve();
    }

    @PluginMethod
    public void stopNfc(PluginCall call) {
        Activity a = getActivity();
        if (nfc != null) a.runOnUiThread(() -> nfc.disableReaderMode(a));
        call.resolve();
    }

    private void onTag(Tag tag) {
        byte[] id = tag.getId();
        StringBuilder hex = new StringBuilder();
        for (byte b : id) hex.append(String.format("%02X", b));
        JSObject d = new JSObject();
        d.put("uid", hex.toString());
        // Número decimal (formato usado por muitas catracas e crachás impressos): bytes em ordem invertida.
        long dec = 0;
        for (int i = Math.min(id.length, 7) - 1; i >= 0; i--) dec = (dec << 8) | (id[i] & 0xFF);
        d.put("decimal", Long.toString(dec));
        d.put("tech", new JSArray(java.util.Arrays.asList(tag.getTechList())));
        notifyListeners("nfcTag", d);
    }

    // ------------------------------------------------------------------ sistema
    @PluginMethod
    public void openWifiSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_WIFI_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openSystemSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Sai do modo quiosque (só depois da senha do administrador, conferida no app). */
    @PluginMethod
    public void exitKiosk(PluginCall call) {
        Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                ActivityManager am = (ActivityManager) a.getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE) a.stopLockTask();
            } catch (Exception ignored) { }
            call.resolve();
        });
    }
}
