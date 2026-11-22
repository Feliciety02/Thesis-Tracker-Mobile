package com.feliciety02.thesistracker;

import android.content.Context;
import android.util.AtomicFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Private, durable copy of uploads. WorkManager data never contains photos or login tokens. */
final class UploadStore {
    private static final Object LOCK = new Object();
    // A queued JSON file includes the whole base64 photo. Status polls must read
    // these files only once per process, then use this small in-memory index.
    private static Map<String, JSONObject> pendingIndex;
    private static String activeKey = "", activeOwner = "";
    private static long activeAt, activeStarted;
    private UploadStore() {}

    private static JSONObject summary(JSONObject job) throws JSONException {
        JSONObject item = new JSONObject();
        item.put("key", job.getString("key"));
        item.put("at", job.getLong("at"));
        item.put("error", job.optString("error", ""));
        item.put("owner", job.optString("owner", ""));
        return item;
    }

    private static void ensureIndex(Context context) throws IOException, JSONException {
        if (pendingIndex != null) return;
        Map<String, JSONObject> found = new HashMap<>();
        for (File file : list(folder(context, "pending"))) {
            JSONObject job = read(file);
            if (job != null) found.put(job.getString("key"), summary(job));
        }
        pendingIndex = found;
    }

    private static void indexJob(JSONObject job) throws JSONException {
        if (pendingIndex != null) pendingIndex.put(job.getString("key"), summary(job));
    }

    static void begin(JSONObject job) {
        synchronized (LOCK) {
            activeKey = job.optString("key", "");
            activeOwner = job.optString("owner", "");
            activeAt = job.optLong("at", 0);
            activeStarted = System.currentTimeMillis();
        }
    }

    static void end(JSONObject job) {
        synchronized (LOCK) {
            if (!activeKey.equals(job.optString("key", "")) || activeAt != job.optLong("at", 0)) return;
            activeKey = activeOwner = "";
            activeAt = activeStarted = 0;
        }
    }

    private static File folder(Context context, String name) throws IOException {
        File dir = new File(context.getFilesDir(), "drive-uploads/" + name);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create upload storage");
        return dir;
    }

    private static File file(Context context, String group, String key) throws IOException {
        if (key == null || !key.matches("(?:[A-Z]{2}-[0-9]{3,}_[0-9]+|rcpt_[0-9]+)"))
            throw new IOException("Invalid upload key");
        return new File(folder(context, group), key + ".json");
    }

    private static JSONObject read(File file) throws IOException, JSONException {
        if (!file.isFile()) return null;
        try (FileInputStream in = new AtomicFile(file).openRead(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
        }
    }

    private static void write(File file, JSONObject value) throws IOException {
        AtomicFile atomic = new AtomicFile(file);
        FileOutputStream out = null;
        try {
            out = atomic.startWrite();
            out.write(value.toString().getBytes(StandardCharsets.UTF_8));
            atomic.finishWrite(out);
        } catch (IOException e) {
            if (out != null) atomic.failWrite(out);
            throw e;
        }
    }

    static void enqueue(Context context, JSONObject job) throws IOException, JSONException {
        synchronized (LOCK) {
            String key = job.getString("key");
            if (job.optString("owner", "").isEmpty()) throw new IOException("Upload owner is missing");
            long at = job.getLong("at");
            String b64 = job.getString("b64");
            if (at <= 0 || b64.length() < 100 || b64.length() > 12_000_000)
                throw new IOException("Invalid photo upload");
            File pending = file(context, "pending", key);
            File done = file(context, "done", key);
            JSONObject prior = read(done);
            if (prior != null && prior.optLong("at") == at) return;
            if (prior != null && !done.delete()) throw new IOException("Cannot replace completed upload");
            write(pending, job);
            indexJob(job);
        }
    }

    static boolean hasPending(Context context) throws IOException {
        synchronized (LOCK) { return list(folder(context, "pending")).length > 0; }
    }

    private static File[] list(File dir) {
        File[] files = dir.listFiles((parent, name) -> name.endsWith(".json"));
        if (files == null) return new File[0];
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        return files;
    }

    static JSONObject next(Context context, Set<String> skipped, String owner) throws IOException, JSONException {
        synchronized (LOCK) {
            ensureIndex(context);
            for (File pending : list(folder(context, "pending"))) {
                String key = pending.getName().replaceFirst("\\.json$", "");
                JSONObject item = pendingIndex.get(key);
                if (item != null && (!owner.equals(item.optString("owner", "")) || skipped.contains(key))) continue;
                JSONObject job = read(pending);
                if (job == null) continue;
                if (!owner.equals(job.optString("owner", ""))) continue;
                if (skipped.contains(job.getString("key"))) continue;
                JSONObject done = read(file(context, "done", job.getString("key")));
                if (done != null && done.optLong("at") == job.optLong("at")) {
                    if (!pending.delete()) throw new IOException("Cannot clear completed upload");
                    pendingIndex.remove(key);
                    continue;
                }
                return job;
            }
            return null;
        }
    }

    static void complete(Context context, JSONObject job, JSONObject patch) throws IOException, JSONException {
        synchronized (LOCK) {
            String key = job.getString("key");
            File pending = file(context, "pending", key);
            JSONObject current = read(pending);
            if (current == null || current.optLong("at") != job.getLong("at")) return; // a retake replaced it
            JSONObject done = new JSONObject();
            done.put("key", key);
            done.put("at", job.getLong("at"));
            done.put("kind", job.optString("kind", "sample"));
            done.put("owner", job.optString("owner", ""));
            done.put("patch", patch);
            write(file(context, "done", key), done);
            if (!pending.delete()) throw new IOException("Cannot clear uploaded photo");
            if (pendingIndex != null) pendingIndex.remove(key);
        }
    }

    static void markError(Context context, JSONObject job, String message) throws IOException, JSONException {
        synchronized (LOCK) {
            File pending = file(context, "pending", job.getString("key"));
            JSONObject current = read(pending);
            if (current == null || current.optLong("at") != job.getLong("at")) return;
            current.put("error", message.length() > 180 ? message.substring(0, 180) : message);
            write(pending, current);
            indexJob(current);
        }
    }

    static void clearError(Context context, JSONObject job) throws IOException, JSONException {
        synchronized (LOCK) {
            File pending = file(context, "pending", job.getString("key"));
            JSONObject current = read(pending);
            if (current == null || current.optLong("at") != job.getLong("at") || !current.has("error")) return;
            current.remove("error");
            write(pending, current);
            indexJob(current);
        }
    }

    static JSONObject status(Context context) throws IOException, JSONException {
        synchronized (LOCK) {
            JSONArray pending = new JSONArray(), done = new JSONArray();
            ensureIndex(context);
            for (JSONObject item : pendingIndex.values()) pending.put(item);
            for (File f : list(folder(context, "done"))) {
                JSONObject item = read(f);
                if (item != null) done.put(item);
            }
            JSONObject result = new JSONObject();
            result.put("pending", pending);
            result.put("completed", done);
            if (!activeKey.isEmpty()) {
                JSONObject active = new JSONObject();
                active.put("key", activeKey);
                active.put("owner", activeOwner);
                active.put("at", activeAt);
                active.put("started", activeStarted);
                result.put("active", active);
            }
            return result;
        }
    }

    static void acknowledge(Context context, String key, long at) throws IOException, JSONException {
        synchronized (LOCK) {
            File done = file(context, "done", key);
            JSONObject current = read(done);
            if (current != null && current.optLong("at") == at && !done.delete())
                throw new IOException("Cannot clear upload confirmation");
        }
    }

    static void cancel(Context context, String key) throws IOException {
        synchronized (LOCK) {
            File pending = file(context, "pending", key), done = file(context, "done", key);
            if (pending.exists() && !pending.delete()) throw new IOException("Cannot cancel pending upload");
            if (done.exists() && !done.delete()) throw new IOException("Cannot cancel completed upload");
            if (pendingIndex != null) pendingIndex.remove(key);
        }
    }
}
