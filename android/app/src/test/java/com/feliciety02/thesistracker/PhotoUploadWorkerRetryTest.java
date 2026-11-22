package com.feliciety02.thesistracker;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import org.junit.Test;

public class PhotoUploadWorkerRetryTest {
    @Test public void retriesNetworkFailuresWithoutMarkingThePhotoPermanent() {
        assertTrue(PhotoUploadWorker.retryable(new SocketTimeoutException("Read timed out")));
        assertTrue(PhotoUploadWorker.retryable(new SocketException("Software caused connection abort")));
        assertTrue(PhotoUploadWorker.retryable(new IOException("Upload server returned HTTP 503")));
        assertTrue(PhotoUploadWorker.retryable(new IOException("Upload server returned HTTP 429")));
        assertTrue(PhotoUploadWorker.retryable(new IOException("Upload server returned HTTP 408")));
        assertFalse(PhotoUploadWorker.retryable(new IOException("Google Drive access is not authorized")));
    }

    @Test public void recognizesUnexpectedWebPagesBeforeParsingUploadConfirmations() {
        assertFalse(PhotoUploadWorker.looksLikeJsonObject("<!doctype html><title>Sign in</title>"));
        assertFalse(PhotoUploadWorker.looksLikeJsonObject(" \\n <html>Error</html>"));
        assertTrue(PhotoUploadWorker.looksLikeJsonObject("  { \"ok\": true }"));
    }
}
