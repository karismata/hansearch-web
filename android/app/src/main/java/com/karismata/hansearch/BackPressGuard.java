package com.karismata.hansearch;

/** Arms exit only for consecutive back presses on the home screen. */
final class BackPressGuard {
    private long armedAt = -1;

    boolean shouldExit(long now) {
        if (armedAt >= 0 && now >= armedAt && now - armedAt < 2000) {
            reset();
            return true;
        }
        armedAt = now;
        return false;
    }

    void reset() {
        armedAt = -1;
    }
}
