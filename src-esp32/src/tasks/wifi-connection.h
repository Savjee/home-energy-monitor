#ifndef TASK_WIFI_CONNECTION
#define TASK_WIFI_CONNECTION

#include <Arduino.h>
#include "WiFi.h"
#include "../config/enums.h"
#include "../config/config.h"

extern DisplayValues gDisplayValues;
extern void goToDeepSleep();

/**
 * Task: monitor the WiFi connection and keep it alive!
 * 
 * When a WiFi connection is established, this task will check it every 10 seconds 
 * to make sure it's still alive.
 * 
 * If not, a reconnect is attempted. If this fails to finish within the timeout,
 * the ESP32 is send to deep sleep in an attempt to recover from this.
 */
void keepWiFiAlive(void * parameter){
    for(;;){
        if(WiFi.status() == WL_CONNECTED){
            vTaskDelay(10000 / portTICK_PERIOD_MS);
            continue;
        }

        serial_println(F("[WIFI] Connecting"));
        gDisplayValues.currentState = CONNECTING_WIFI;

        WiFi.mode(WIFI_STA);
        WiFi.setHostname(DEVICE_NAME);
        WiFi.begin(WIFI_NETWORK, WIFI_PASSWORD);

        unsigned long startAttemptTime = millis();

        // Keep looping while we're not connected and haven't reached the timeout
        while (WiFi.status() != WL_CONNECTED && 
                millis() - startAttemptTime < WIFI_TIMEOUT){}

        // Make sure that we're actually connected, otherwise go to deep sleep
        if(WiFi.status() != WL_CONNECTED){
            serial_println(F("[WIFI] FAILED"));
            vTaskDelay(WIFI_RECOVER_TIME_MS / portTICK_PERIOD_MS);
        }

        serial_println(F("[WIFI] Connected: " + WiFi.localIP()));
        gDisplayValues.currentState = UP;
    }
}

#endif