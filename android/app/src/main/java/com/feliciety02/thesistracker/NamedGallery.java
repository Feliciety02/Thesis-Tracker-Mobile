package com.feliciety02.thesistracker;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Saves the exact sample filename in the phone's public Pictures collection. */
final class NamedGallery {
    private static final Pattern SAMPLE_NAME = Pattern.compile("^([A-Z]{2}-[0-9]{3,})_0([1-5])\\.jpg$", Pattern.CASE_INSENSITIVE);
    private static final String TRACKER_FOLDER = "/pictures/banana thesis tracker/";
    private NamedGallery() {}

    private static final class GalleryPhoto {
        final String name, id;
        final int angle;
        final long at, mediaId;
        final Uri uri;

        GalleryPhoto(String name, String id, int angle, long at, long mediaId, Uri uri) {
            this.name = name; this.id = id; this.angle = angle;
            this.at = at; this.mediaId = mediaId; this.uri = uri;
        }
    }

    /** Scan only the public folder that this app writes. This also works after uninstall erased its URI preferences. */
    private static Map<String, GalleryPhoto> namedPhotos(Context context) throws IOException {
        Map<String, GalleryPhoto> found = new HashMap<>();
        String[] columns = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? new String[] { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.RELATIVE_PATH, MediaStore.Images.Media.DATE_ADDED }
            : new String[] { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATA, MediaStore.Images.Media.DATE_ADDED };
        String pathColumn = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA;
        String selection = pathColumn + " LIKE ?";
        String[] args = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? new String[] { "%Banana Thesis Tracker%" }
            : new String[] { "%/Pictures/Banana Thesis Tracker/%" };
        try (Cursor cursor = context.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            columns, selection, args, null)) {
            if (cursor == null) throw new IOException("Could not scan Gallery photos");
            while (cursor.moveToNext()) {
                String path = cursor.getString(2);
                if (path == null || !("/" + path.replace('\\', '/').toLowerCase()).contains(TRACKER_FOLDER)) continue;
                String name = cursor.getString(1);
                if (name == null) continue;
                Matcher match = SAMPLE_NAME.matcher(name);
                if (!match.matches()) continue;
                long mediaId = cursor.getLong(0), at = cursor.getLong(3) * 1000L;
                String id = match.group(1).toUpperCase(), normalized = id + "_0" + match.group(2) + ".jpg";
                GalleryPhoto old = found.get(normalized);
                if (old == null || at > old.at || at == old.at && mediaId > old.mediaId)
                    found.put(normalized, new GalleryPhoto(normalized, id, Integer.parseInt(match.group(2)), at,
                        mediaId, ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId)));
            }
        } catch (SecurityException e) { throw new IOException("Allow access to all Gallery photos to recover samples", e); }
        return found;
    }

    static JSONArray scan(Context context) throws IOException, JSONException {
        List<GalleryPhoto> photos = new ArrayList<>(namedPhotos(context).values());
        photos.sort((a, b) -> a.name.compareTo(b.name));
        JSONArray result = new JSONArray();
        for (GalleryPhoto photo : photos) {
            JSONObject item = new JSONObject();
            item.put("id", photo.id);
            item.put("angle", photo.angle);
            item.put("name", photo.name);
            item.put("at", photo.at);
            result.put(item);
        }
        return result;
    }

    private static InputStream source(Context context, String sourceUri, String b64) throws IOException {
        if (sourceUri != null && !sourceUri.isEmpty()) {
            Uri uri = Uri.parse(sourceUri);
            if ("content".equals(uri.getScheme()) || "file".equals(uri.getScheme())) {
                InputStream in = context.getContentResolver().openInputStream(uri);
                if (in != null) return in;
            } else if (uri.getScheme() == null) {
                return new FileInputStream(sourceUri);
            }
        }
        if (b64 == null || b64.length() < 100) throw new IOException("Photo is not readable");
        try { return new ByteArrayInputStream(Base64.decode(b64, Base64.DEFAULT)); }
        catch (IllegalArgumentException e) { throw new IOException("Invalid photo data", e); }
    }

    static String save(Context context, String name, String sourceUri, String b64) throws IOException {
        if (name == null || !name.matches("[A-Za-z0-9_-]{1,95}\\.jpg")) throw new IOException("Invalid Gallery filename");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Banana Thesis Tracker");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create Gallery folder");
            File target = new File(dir, name);
            try (InputStream in = source(context, sourceUri, b64); OutputStream out = new FileOutputStream(target)) { copy(in, out); }
            MediaScannerConnection.scanFile(context, new String[] { target.getAbsolutePath() }, new String[] { "image/jpeg" }, null);
            return Uri.fromFile(target).toString();
        }
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Banana Thesis Tracker");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri target = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (target == null) throw new IOException("Cannot create Gallery photo");
        String old = context.getSharedPreferences("named-gallery", Context.MODE_PRIVATE).getString(name, "");
        try {
            try (InputStream in = source(context, sourceUri, b64); OutputStream out = resolver.openOutputStream(target)) {
                if (out == null) throw new IOException("Cannot write Gallery photo");
                copy(in, out);
            }
            if (!old.isEmpty() && !old.equals(target.toString())) {
                try { resolver.delete(Uri.parse(old), null, null); } catch (SecurityException ignored) { /* stale URI */ }
            }
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Images.Media.IS_PENDING, 0);
            ready.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            if (resolver.update(target, ready, null, null) < 1) throw new IOException("Cannot publish Gallery photo");
        } catch (Exception e) {
            resolver.delete(target, null, null);
            throw e instanceof IOException ? (IOException) e : new IOException("Gallery save failed", e);
        }
        context.getSharedPreferences("named-gallery", Context.MODE_PRIVATE).edit().putString(name, target.toString()).apply();
        return target.toString();
    }

    static boolean delete(Context context, String name) throws IOException {
        if (name == null || !name.matches("[A-Za-z0-9_-]{1,95}\\.jpg")) throw new IOException("Invalid Gallery filename");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File target = new File(new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Banana Thesis Tracker"), name);
            if (!target.exists()) return false;
            if (!target.delete()) throw new IOException("Cannot delete Gallery photo");
            MediaScannerConnection.scanFile(context, new String[] { target.getAbsolutePath() }, null, null);
            return true;
        }
        String saved = context.getSharedPreferences("named-gallery", Context.MODE_PRIVATE).getString(name, "");
        if (saved.isEmpty()) {
            GalleryPhoto recovered = namedPhotos(context).get(name);
            if (recovered != null) saved = recovered.uri.toString();
        }
        if (saved.isEmpty()) return false;
        try {
            boolean deleted = context.getContentResolver().delete(Uri.parse(saved), null, null) > 0;
            context.getSharedPreferences("named-gallery", Context.MODE_PRIVATE).edit().remove(name).apply();
            return deleted;
        } catch (SecurityException e) {
            throw new IOException("Cannot delete Gallery photo", e);
        }
    }

    static String readBase64(Context context, String name) throws IOException {
        if (name == null || !name.matches("[A-Za-z0-9_-]{1,95}\\.jpg")) throw new IOException("Invalid Gallery filename");
        InputStream in;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File file = new File(new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Banana Thesis Tracker"), name);
            if (!file.isFile()) return "";
            in = new FileInputStream(file);
        } else {
            String saved = context.getSharedPreferences("named-gallery", Context.MODE_PRIVATE).getString(name, "");
            in = null;
            if (!saved.isEmpty()) {
                try { in = context.getContentResolver().openInputStream(Uri.parse(saved)); }
                catch (IOException | SecurityException ignored) { /* URI from a previous app installation */ }
            }
            if (in == null) {
                GalleryPhoto photo = namedPhotos(context).get(name);
                if (photo == null) return "";
                in = context.getContentResolver().openInputStream(photo.uri);
            }
            if (in == null) return "";
        }
        try (InputStream source = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[16384];
            int n;
            while ((n = source.read(bytes)) != -1) {
                if (out.size() + n > 20 * 1024 * 1024) throw new IOException("Gallery photo is too large to preview");
                out.write(bytes, 0, n);
            }
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (SecurityException e) { throw new IOException("Cannot read Gallery photo", e); }
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] bytes = new byte[16384];
        int n;
        while ((n = in.read(bytes)) != -1) out.write(bytes, 0, n);
    }
}
