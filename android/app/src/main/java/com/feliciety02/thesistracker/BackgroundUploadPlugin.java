package com.feliciety02.thesistracker;

import android.content.Context;
import android.Manifest;
import android.os.Build;
import androidx.work.ExistingWorkPolicy;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;
import org.json.JSONArray;

@CapacitorPlugin(name = "BackgroundUpload", permissions = {
    @Permission(alias = "legacyGallery", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }),
    @Permission(alias = "readGalleryLegacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
    @Permission(alias = "readGalleryImages", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
    @Permission(alias = "readGallerySelected", strings = { Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED })
})
public class BackgroundUploadPlugin extends Plugin {
    @PluginMethod
    public void saveNamedPhoto(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("legacyGallery") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyGallery", call, "galleryPermissionResult");
            return;
        }
        try {
            call.resolve(new JSObject().put("uri", NamedGallery.save(getContext(), call.getString("name", ""),
                call.getString("uri", ""), call.getString("b64", ""))));
        } catch (Exception e) { call.reject("Could not save named photo to Gallery", e); }
    }

    @PermissionCallback
    private void galleryPermissionResult(PluginCall call) {
        if (getPermissionState("legacyGallery") == PermissionState.GRANTED) saveNamedPhoto(call);
        else call.reject("Allow photo storage access to save the named Gallery copy");
    }

    @PluginMethod
    public void deleteNamedPhoto(PluginCall call) {
        try { call.resolve(new JSObject().put("deleted", NamedGallery.delete(getContext(), call.getString("name", "")))); }
        catch (Exception e) { call.reject("Could not delete named photo from Gallery", e); }
    }

    @PluginMethod
    public void readNamedPhoto(PluginCall call) {
        try { call.resolve(new JSObject().put("b64", NamedGallery.readBase64(getContext(), call.getString("name", "")))); }
        catch (Exception e) { call.reject("Could not preview named Gallery photo", e); }
    }

    private boolean fullGalleryAccess() {
        return getPermissionState(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? "readGalleryImages" : "readGalleryLegacy") == PermissionState.GRANTED;
    }

    private boolean selectedGalleryAccess() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            getPermissionState("readGallerySelected") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void scanNamedPhotos(PluginCall call) {
        if (!fullGalleryAccess() && (!selectedGalleryAccess() || call.getBoolean("requestAll", false))) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                requestPermissionForAliases(new String[] { "readGalleryImages", "readGallerySelected" }, call, "galleryScanPermissionResult");
            else requestPermissionForAlias(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? "readGalleryImages" : "readGalleryLegacy", call, "galleryScanPermissionResult");
            return;
        }
        finishGalleryScan(call);
    }

    @PermissionCallback
    private void galleryScanPermissionResult(PluginCall call) { finishGalleryScan(call); }

    private void finishGalleryScan(PluginCall call) {
        boolean full = fullGalleryAccess(), selected = selectedGalleryAccess();
        if (!full && !selected) {
            call.resolve(new JSObject().put("access", "denied").put("photos", new JSONArray()));
            return;
        }
        try { call.resolve(new JSObject().put("access", full ? "full" : "partial")
            .put("photos", NamedGallery.scan(getContext()))); }
        catch (Exception e) { call.reject("Could not scan named Gallery photos", e); }
    }

    @PluginMethod
    public void setSession(PluginCall call) {
        String token = call.getString("token", ""), url = call.getString("url", ""), owner = call.getString("owner", "");
        if (token.isEmpty() || owner.isEmpty() || !url.matches("https://script\\.google\\.com/macros/s/[^/]+/exec")) {
            call.reject("Invalid upload session");
            return;
        }
        boolean saved = getContext().getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE)
            .edit().putString("token", token).putString("url", url).putString("owner", owner).commit();
        if (!saved) { call.reject("Cannot save upload session"); return; }
        try {
            // Opening an updated app should retry its durable queue now, even if an older
            // worker is waiting in exponential backoff after a server-side failure.
            if (UploadStore.hasPending(getContext())) PhotoUploadWorker.schedule(getContext(), ExistingWorkPolicy.REPLACE);
            call.resolve();
        } catch (Exception e) { call.reject("Cannot schedule pending uploads", e); }
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        getContext().getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).edit().clear().apply();
        PhotoUploadWorker.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void enqueue(PluginCall call) {
        JSObject supplied = call.getObject("job");
        if (supplied == null) { call.reject("Missing photo upload"); return; }
        String token = getContext().getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).getString("token", "");
        if (token.isEmpty()) { call.reject("Sign in to queue the Drive upload"); return; }
        try {
            JSONObject job = new JSONObject(supplied.toString());
            String owner = getContext().getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).getString("owner", "");
            if (!owner.equals(job.optString("owner", ""))) { call.reject("Sign in as the photo owner to queue this upload"); return; }
            UploadStore.enqueue(getContext(), job);
            PhotoUploadWorker.schedule(getContext(), ExistingWorkPolicy.APPEND_OR_REPLACE);
            call.resolve();
        } catch (Exception e) { call.reject("Cannot queue the background upload", e); }
    }

    @PluginMethod
    public void status(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(UploadStore.status(getContext()))); }
        catch (Exception e) { call.reject("Cannot read upload status", e); }
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        String key = call.getString("key", "");
        Long at = call.getLong("at", 0L);
        try { UploadStore.acknowledge(getContext(), key, at); call.resolve(); }
        catch (Exception e) { call.reject("Cannot clear upload confirmation", e); }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String key = call.getString("key", "");
        try { UploadStore.cancel(getContext(), key); call.resolve(); }
        catch (Exception e) { call.reject("Cannot cancel upload", e); }
    }
}
