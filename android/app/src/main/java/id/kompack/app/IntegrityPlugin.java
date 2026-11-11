package id.kompack.app;

import android.Manifest;
import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Anti-curang sisi perangkat: memberi tahu aplikasi bila lokasi terakhir berasal dari
 * aplikasi pemalsu GPS (mock location) atau bila aplikasi berjalan di emulator.
 */
@CapacitorPlugin(
    name = "Integrity",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        )
    }
)
public class IntegrityPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "onLocationPermission");
            return;
        }
        respond(call);
    }

    @PermissionCallback
    private void onLocationPermission(PluginCall call) {
        respond(call);
    }

    @SuppressWarnings({ "deprecation", "MissingPermission" })
    private void respond(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("emulator", isEmulator());
        boolean mock = false;
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            Location best = null;
            if (lm != null && getPermissionState("location") == PermissionState.GRANTED) {
                for (String provider : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(provider);
                    if (l == null) continue;
                    boolean isMock = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? l.isMock() : l.isFromMockProvider();
                    // satu saja pembacaan palsu yang masih segar sudah cukup untuk menolak
                    if (isMock && System.currentTimeMillis() - l.getTime() < 10 * 60 * 1000) mock = true;
                    if (best == null || l.getTime() > best.getTime()) best = l;
                }
            }
            if (best != null) {
                ret.put("lat", best.getLatitude());
                ret.put("lng", best.getLongitude());
                ret.put("acc", best.getAccuracy());
                ret.put("time", best.getTime());
            }
        } catch (Exception ignored) {
            // tanpa izin / layanan lokasi mati: aplikasi memakai pemeriksaan lain
        }
        ret.put("mock", mock);
        call.resolve(ret);
    }

    private static boolean isEmulator() {
        String f = String.valueOf(Build.FINGERPRINT);
        String m = String.valueOf(Build.MODEL);
        String h = String.valueOf(Build.HARDWARE);
        String p = String.valueOf(Build.PRODUCT);
        return f.startsWith("generic") || f.contains("emulator") || m.contains("Emulator") || m.contains("Android SDK built for")
            || h.contains("goldfish") || h.contains("ranchu") || p.contains("sdk_gphone") || p.contains("emulator");
    }
}
