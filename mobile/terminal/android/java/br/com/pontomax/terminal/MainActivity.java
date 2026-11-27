package br.com.pontomax.terminal;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Terminal de ponto em tela cheia (quiosque):
 *  - modo imersivo SEMPRE: barras de status e navegação escondidas; se aparecerem (deslize, teclado,
 *    aviso do sistema), o app esconde de novo em seguida — e reforça a cada 1,5 s;
 *  - tela sempre ligada enquanto o app estiver aberto;
 *  - botão "voltar" não fecha o terminal;
 *  - modo quiosque (lock task) quando o aparelho foi provisionado como dispositivo dedicado
 *    (ver mobile/terminal/README.md); sem isso, segue em tela cheia normal, sem pedir nada ao usuário;
 *  - como dono do dispositivo, também desliga a barra de notificações e a tela de bloqueio.
 */
public class MainActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable keepImmersive = new Runnable() {
        @Override
        public void run() {
            enterImmersive();
            handler.postDelayed(this, 1500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TerminalDevicePlugin.class); // rede local, NFC e atalhos do sistema
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Intencionalmente vazio: o terminal não fecha pelo botão voltar.
            }
        });
        enterImmersive();
        // Barras que reaparecem (deslize, teclado, diálogo do sistema) somem de novo em seguida.
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility -> handler.postDelayed(this::enterImmersive, 600));
    }

    @Override
    public void onResume() {
        super.onResume();
        enterImmersive();
        startKioskIfPermitted();
        handler.removeCallbacks(keepImmersive);
        handler.postDelayed(keepImmersive, 1500);
    }

    @Override
    public void onPause() {
        handler.removeCallbacks(keepImmersive);
        super.onPause();
    }

    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        handler.postDelayed(this::enterImmersive, 300);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    private void enterImmersive() {
        View decor = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private void startKioskIfPermitted() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (dpm == null || am == null) return;
        // Dono do dispositivo (ver mobile/terminal/README.md): autoriza o próprio app no quiosque.
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            ComponentName admin = new ComponentName(this, KioskAdminReceiver.class);
            dpm.setLockTaskPackages(admin, new String[] { getPackageName() });
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    dpm.setStatusBarDisabled(admin, true);   // sem puxar a barra de notificações
                    dpm.setKeyguardDisabled(admin, true);    // sem tela de bloqueio ao ligar
                } catch (SecurityException ignored) { }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE); // sem início, recentes e avisos
                } catch (SecurityException ignored) { }
            }
        }
        boolean permitted = dpm.isLockTaskPermitted(getPackageName());
        boolean alreadyLocked = am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        if (permitted && !alreadyLocked) {
            try {
                startLockTask();
            } catch (IllegalStateException | SecurityException ignored) {
                // Sem permissão de quiosque: continua em tela cheia comum.
            }
        }
    }
}
