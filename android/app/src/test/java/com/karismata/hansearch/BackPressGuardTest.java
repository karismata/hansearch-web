package com.karismata.hansearch;

import org.junit.Test;
import static org.junit.Assert.*;

public class BackPressGuardTest {
    @Test public void firstPressNeverExits() {
        assertFalse(new BackPressGuard().shouldExit(0));
    }
    @Test public void secondPressWithinTwoSecondsExits() {
        BackPressGuard guard = new BackPressGuard();
        assertFalse(guard.shouldExit(100));
        assertTrue(guard.shouldExit(2099));
        assertFalse(guard.shouldExit(2100));
    }
    @Test public void timeoutRequiresAnotherConfirmation() {
        BackPressGuard guard = new BackPressGuard();
        assertFalse(guard.shouldExit(100));
        assertFalse(guard.shouldExit(2100));
        assertTrue(guard.shouldExit(2200));
    }
    @Test public void navigationOrBackgroundingDisarmsExit() {
        BackPressGuard guard = new BackPressGuard();
        assertFalse(guard.shouldExit(100));
        guard.reset();
        assertFalse(guard.shouldExit(200));
    }
    @Test public void clockCannotMoveBackIntoExitWindow() {
        BackPressGuard guard = new BackPressGuard();
        assertFalse(guard.shouldExit(100));
        assertFalse(guard.shouldExit(50));
    }
}
