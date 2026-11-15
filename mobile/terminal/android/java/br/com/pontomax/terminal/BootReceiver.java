package br.com.pontomax.terminal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Abre o terminal automaticamente quando o aparelho liga (tablet dedicado ao ponto). */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(open);
    }
}
