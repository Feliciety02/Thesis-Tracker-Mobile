package com.feliciety02.thesistracker;

import android.content.Context;
import android.os.SystemClock;
import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.InterruptedIOException;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketException;
import java.net.UnknownHostException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Uploads private queued photos even after the app UI closes. */
public final class PhotoUploadWorker extends Worker {
    private static final class ConnectionFailure extends IOException {
        ConnectionFailure(IOException cause) {
            super("Connection to the tracker interrupted. Upload will retry automatically.", cause);
        }
    }

    private static final class UnexpectedResponse extends IOException {
        UnexpectedResponse(Throwable cause) {
            super("Tracker returned a web page instead of upload confirmation. Retrying automatically.", cause);
        }
    }

    private static final String WORK_NAME = "thesis-drive-uploads";

    public PhotoUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context context, ExistingWorkPolicy policy) {
        Constraints connected = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(PhotoUploadWorker.class)
            .setConstraints(connected)
            // DNS can fail while Android still reports a connected network. Linear retries
            // keep later Wi-Fi recovery from being delayed by hours of exponential backoff.
            .setBackoffCriteria(BackoffPolicy.LINEAR, 1, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, policy, request);
    }

    static void retryPending(Context context) throws Exception {
        if (!UploadStore.hasPending(context)) return;
        WorkManager manager = WorkManager.getInstance(context);
        for (WorkInfo work : manager.getWorkInfosForUniqueWork(WORK_NAME).get(5, TimeUnit.SECONDS)) {
            if (work.getState() == WorkInfo.State.RUNNING) return;
        }
        schedule(context, ExistingWorkPolicy.REPLACE);
    }

    static void stop(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
    }

    @NonNull @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String token = context.getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).getString("token", "");
        String url = context.getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).getString("url", "");
        String owner = context.getSharedPreferences("drive-upload-session", Context.MODE_PRIVATE).getString("owner", "");
        if (token.isEmpty() || url.isEmpty() || owner.isEmpty()) return Result.success(); // sign in again; keep the photos
        try {
            JSONObject job;
            Set<String> failed = new HashSet<>();
            long started = SystemClock.elapsedRealtime();
            while (!isStopped() && (job = UploadStore.next(context, failed, owner)) != null) {
                // WorkManager stops ordinary workers after about ten minutes. Yield before
                // starting another large upload so the queue can resume cleanly next run.
                if (SystemClock.elapsedRealtime() - started > TimeUnit.MINUTES.toMillis(7)) return Result.retry();
                UploadStore.begin(job);
                try {
                    UploadStore.clearError(context, job);
                    if (job.optBoolean("firstCapture") && job.optString("date", "").matches("\\d{4}-\\d{2}-\\d{2}")) {
                        JSONArray dateArgs = new JSONArray();
                        dateArgs.put(job.getString("id"));
                        dateArgs.put("date");
                        dateArgs.put(job.getString("date"));
                        JSONObject dateResponse = postRequest(url, token, "updateSample", dateArgs);
                        if (dateResponse.optBoolean("auth")) throw new SessionExpiredException();
                        if (!dateResponse.optBoolean("ok"))
                            throw new IOException(dateResponse.optString("error", "Could not save capture date"));
                    }
                    JSONObject response = post(url, token, job);
                    if (response.optBoolean("auth")) throw new SessionExpiredException();
                    if (!response.optBoolean("ok"))
                        throw new IOException(response.optString("error", "Google Drive upload failed"));
                    UploadStore.complete(context, job, response.optJSONObject("data"));
                } catch (ConnectionFailure | UnexpectedResponse error) {
                    UploadStore.markError(context, job, error.getMessage());
                    return Result.retry();
                } catch (Exception error) {
                    if (retryable(error)) return Result.retry();
                    UploadStore.markError(context, job, error.getMessage() == null ? error.toString() : error.getMessage());
                    if (error instanceof SessionExpiredException) return Result.success(); // sign in again; keep the queue
                    failed.add(job.getString("key"));
                } finally {
                    UploadStore.end(job);
                }
            }
            // Permanent errors stay in the queue for review, without retrying every
            // minute or holding up newly queued work behind this worker.
            return isStopped() ? Result.retry() : Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static final class SessionExpiredException extends IOException {
        SessionExpiredException() { super("Please sign in again to finish pending Google Drive uploads."); }
    }

    static boolean retryable(Exception error) {
        if (error instanceof InterruptedIOException || error instanceof ConnectException ||
            error instanceof UnknownHostException || error instanceof SocketException || error instanceof EOFException) return true;
        String message = String.valueOf(error.getMessage()).toLowerCase(java.util.Locale.ROOT);
        return message.contains("timeout") || message.contains("timed out") ||
            message.contains("connection abort") || message.contains("connection reset") ||
            message.contains("connection closed") || message.contains("network is unreachable") ||
            message.contains("unable to resolve host") || message.contains("temporarily unavailable") ||
            message.matches(".*http (?:408|429|5\\d\\d).*");
    }

    static boolean looksLikeJsonObject(String body) {
        return body != null && body.trim().startsWith("{");
    }

    static JSONObject post(String apiUrl, String token, JSONObject job) throws Exception {
        JSONArray args = new JSONArray();
        String fn;
        if ("receipt".equals(job.optString("kind"))) {
            fn = "uploadReceipt";
            args.put(job.getInt("row"));
            args.put(job.getString("b64"));
            args.put(job.optString("item", ""));
            args.put(job.optString("expenseDate", ""));
        } else {
            fn = "uploadPhoto";
            args.put(job.getString("id"));
            args.put(job.getInt("angle"));
            args.put(job.getString("b64"));
            args.put(job.optString("date", ""));
            args.put(job.optLong("at", 0));
        }
        return postRequest(apiUrl, token, fn, args);
    }

    static JSONObject postRequest(String apiUrl, String token, String fn, JSONArray args) throws Exception {
        JSONObject request = new JSONObject();
        request.put("token", token);
        request.put("fn", fn);
        request.put("args", args);
        byte[] body = request.toString().getBytes(StandardCharsets.UTF_8);
        URL endpoint = new URL(apiUrl);
        for (int redirects = 0; redirects < 5; redirects++) {
            String host = endpoint.getHost();
            if (!"https".equals(endpoint.getProtocol()) ||
                !("script.google.com".equals(host) || "script.googleusercontent.com".equals(host)))
                throw new IOException("Unexpected upload destination");
            HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(120000);
            boolean submit = redirects == 0;
            try {
                if (submit) {
                    connection.setRequestMethod("POST");
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
                    try (OutputStream out = connection.getOutputStream()) { out.write(body); }
                }
                int code = connection.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Upload redirect had no location");
                    endpoint = new URL(endpoint, location);
                    continue;
                }
                if (code < 200 || code >= 300) throw new IOException("Upload server returned HTTP " + code);
                try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[16384];
                    int n;
                    while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                    String response = out.toString(StandardCharsets.UTF_8.name());
                    if (!looksLikeJsonObject(response)) throw new UnexpectedResponse(null);
                    try { return new JSONObject(response); }
                    catch (JSONException error) { throw new UnexpectedResponse(error); }
                }
            } catch (java.net.SocketException | java.net.SocketTimeoutException | java.net.UnknownHostException error) {
                throw new ConnectionFailure(error);
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many upload redirects");
    }
}
